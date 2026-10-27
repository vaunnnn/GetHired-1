-- Operator migration, after B4. Review auth.users/Auth token compatibility before deployment.
begin;
alter table gethired_private.accounts alter column auth_user_id drop not null;
alter table gethired_private.accounts add constraint accounts_pending_identity check
  (auth_user_id is not null or (role = 'student' and status = 'pending'));
alter table gethired_private.accounts add column credentials_blocked boolean not null default false;
alter table gethired_private.accounts add column credential_version integer not null default 0;
create function gethired_private.advance_credential_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.credentials_blocked and not old.credentials_blocked) or new.status is distinct from old.status
    or new.role is distinct from old.role then new.credential_version := old.credential_version + 1; end if;
  return new;
end;
$$;
revoke all on function gethired_private.advance_credential_version() from public, anon, authenticated;
create trigger credential_generation before update on gethired_private.accounts
  for each row execute function gethired_private.advance_credential_version();

create table gethired_private.onboarding_operations (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('signup', 'invite', 'recovery')),
  email text not null,
  browser_hash text,
  profile jsonb,
  account_id uuid references gethired_private.accounts(id),
  auth_user_id uuid,
  proof_hash text,
  provider_type text check (provider_type in ('signup', 'invite', 'recovery')),
  state text not null default 'queued' check (state in ('queued', 'sent', 'verifying', 'verified', 'completed', 'superseded', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  send_attempts integer not null default 0 check (send_attempts >= 0),
  available_at timestamptz not null default clock_timestamp(),
  lease_token uuid,
  leased_until timestamptz,
  provider_credential text,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  check (purpose <> 'signup' or (profile is not null and browser_hash is not null)),
  check (expires_at > created_at)
);
create index onboarding_email on gethired_private.onboarding_operations(email, created_at);
create index onboarding_retry on gethired_private.onboarding_operations(available_at) where state = 'queued';
create unique index onboarding_invite_proof on gethired_private.onboarding_operations(proof_hash) where purpose = 'invite' and proof_hash is not null;
revoke all on gethired_private.onboarding_operations from public, anon, authenticated;
grant select, insert, update on gethired_private.onboarding_operations to gethired_runtime;
-- Runtime can edit student records through application authorization; roles/emails/identity
-- changes are restricted to the bridges below. There is no account DELETE privilege.
grant update (display_name, status, credentials_blocked) on gethired_private.accounts to gethired_runtime;
grant insert, update (first_name, last_name, course, year_level) on gethired_private.student_profiles to gethired_runtime;

create function gethired_private.create_pending_student(p_email text, p_first text, p_last text, p_course text, p_year text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if p_email !~ '^[0-9]{8}@usc\.edu\.ph$' or length(trim(p_first)) not between 1 and 100 or length(trim(p_last)) not between 1 and 100
    or p_course not in ('BS Computer Science','BS Information Technology','BS Information Systems','BS Data Science')
    or p_year not in ('1st Year','2nd Year','3rd Year','4th Year','5th Year') then raise exception 'Invalid profile'; end if;
  insert into gethired_private.accounts(email, display_name, role, status)
    values (p_email, p_first || ' ' || p_last, 'student', 'pending') returning id into result;
  insert into gethired_private.student_profiles(account_id, student_number, first_name, last_name, course, year_level)
    values (result, split_part(p_email, '@', 1), p_first, p_last, p_course, p_year);
  return result;
end;
$$;

-- Restricted provider snapshot, only for a live durable operation. Never expose this
-- bridge or its output over HTTP. The API stores an HMAC, never this bearer hash.
-- Supabase Auth currently uses SHA-224(email || OTP); hosted acceptance checks this.
create function gethired_private.setup_provider_snapshot(p_operation uuid)
returns table(user_id uuid, email text, confirmed boolean, token_hash text, sent_at timestamptz)
language sql security definer set search_path = '' as $$
  select u.id, u.email::text, u.email_confirmed_at is not null,
    case when o.provider_type = 'recovery' then u.recovery_token else u.confirmation_token end::text,
    case when o.provider_type = 'recovery' then u.recovery_sent_at else u.confirmation_sent_at end
  from gethired_private.onboarding_operations o join auth.users u on lower(u.email) = o.email
  where o.id = p_operation and o.expires_at > clock_timestamp() and o.state not in ('completed','superseded')
    and (u.banned_until is null or u.banned_until <= clock_timestamp())
    and (o.auth_user_id is null or o.auth_user_id = u.id);
$$;

-- Email + provider ID must be proven by Auth, never by user metadata.
create function gethired_private.bind_verified_student(p_operation uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare op gethired_private.onboarding_operations; a gethired_private.accounts; p jsonb;
begin
  select * into op from gethired_private.onboarding_operations where id = p_operation for update;
  if not found or op.purpose not in ('signup','invite') or op.state <> 'verified' or op.expires_at <= clock_timestamp()
    or not exists(select 1 from auth.users u where u.id = op.auth_user_id and lower(u.email) = op.email and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until <= clock_timestamp())) then raise exception 'Invalid setup'; end if;
  perform pg_advisory_xact_lock(hashtextextended(op.email, 5));
  select * into a from gethired_private.accounts where lower(email) = op.email for update;
  if not found then
    if op.purpose <> 'signup' then raise exception 'Missing account'; end if;
    p := op.profile;
    a.id := gethired_private.create_pending_student(op.email, p->>'firstName', p->>'lastName', p->>'course', p->>'yearLevel');
    select * into a from gethired_private.accounts where id = a.id for update;
  end if;
  if a.role <> 'student' or a.status <> 'pending' or (a.auth_user_id is not null and a.auth_user_id <> op.auth_user_id)
    then raise exception 'Account unavailable'; end if;
  update gethired_private.accounts set auth_user_id = op.auth_user_id, credentials_blocked = true where id = a.id;
  update gethired_private.onboarding_operations set account_id = a.id where id = op.id;
  return a.id;
end;
$$;

-- Completes only a verified operation. Removes all provider sessions, including the
-- temporary verification session and sessions created during a provider/DB failure.
create function gethired_private.finish_account_setup(p_operation uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare op gethired_private.onboarding_operations; a gethired_private.accounts;
begin
  select * into op from gethired_private.onboarding_operations where id = p_operation;
  select * into a from gethired_private.accounts where id = op.account_id for update;
  if op.state <> 'verified' or op.expires_at <= clock_timestamp() or a.id is null or a.auth_user_id is distinct from op.auth_user_id
    or not exists(select 1 from auth.users u where u.id = op.auth_user_id and lower(u.email) = op.email and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until <= clock_timestamp()))
    or not a.credentials_blocked or (op.purpose = 'recovery' and a.status <> 'active')
    or (op.purpose <> 'recovery' and a.status <> 'pending') then raise exception 'Invalid setup'; end if;
  delete from auth.refresh_tokens where session_id in (select id from auth.sessions where user_id = op.auth_user_id);
  delete from auth.sessions where user_id = op.auth_user_id;
  update gethired_private.sessions set revoked_at = coalesce(revoked_at, clock_timestamp()) where account_id = a.id;
  update gethired_private.accounts set status = 'active', credentials_blocked = false where id = a.id;
  update gethired_private.onboarding_operations set state = 'completed', completed_at = clock_timestamp(),
    provider_credential = null, profile = null where id = op.id;
  update gethired_private.onboarding_operations set state = 'superseded', provider_credential = null, profile = null
    where email = op.email and id <> op.id and state not in ('completed','superseded');
end;
$$;
-- Profile can be erased after a signup operation terminates.
alter table gethired_private.onboarding_operations drop constraint onboarding_operations_check;
alter table gethired_private.onboarding_operations add constraint signup_profile_required
  check (purpose <> 'signup' or state in ('completed','superseded','failed') or (profile is not null and browser_hash is not null));

revoke all on function gethired_private.create_pending_student(text,text,text,text,text),
  gethired_private.setup_provider_snapshot(uuid), gethired_private.bind_verified_student(uuid),
  gethired_private.finish_account_setup(uuid) from public, anon, authenticated;
grant execute on function gethired_private.create_pending_student(text,text,text,text,text),
  gethired_private.setup_provider_snapshot(uuid), gethired_private.bind_verified_student(uuid),
  gethired_private.finish_account_setup(uuid) to gethired_runtime;

create function gethired_private.prune_onboarding(p_limit integer default 1000)
returns integer language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  if p_limit < 1 or p_limit > 10000 then raise exception 'Invalid batch size'; end if;
  -- A provider verification response can be lost before its session ID is saved.
  -- These sessions never acquired application authority. Catch them even when the
  -- browser never retries/completes its operation; normal app sessions are excluded.
  insert into gethired_private.provider_cleanup(session_id, auth_user_id)
    select s.id, s.user_id from auth.sessions s
    where exists (select 1 from gethired_private.onboarding_operations o
      where o.auth_user_id = s.user_id and o.state in ('verifying','verified'))
      and not exists (select 1 from gethired_private.sessions a where a.id = s.id)
    limit p_limit on conflict do nothing;
  with expired as (select id from gethired_private.onboarding_operations where expires_at <= clock_timestamp()
    and (profile is not null or provider_credential is not null or state not in ('completed','superseded','failed'))
    limit p_limit for update skip locked)
  update gethired_private.onboarding_operations set profile = null, provider_credential = null,
    state = case when state = 'completed' then state else 'failed' end where id in (select id from expired);
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function gethired_private.prune_onboarding(integer) from public, anon, authenticated, gethired_runtime;
grant execute on function gethired_private.prune_onboarding(integer) to gethired_maintenance;
insert into gethired_private.schema_versions(version) values ('202610130001');
commit;
