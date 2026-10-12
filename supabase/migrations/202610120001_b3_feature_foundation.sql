-- Apply once as the operator, after the B2 migration. Never at API startup.
begin;
create table gethired_private.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references gethired_private.accounts(id),
  request_id uuid not null,
  action text not null check (action ~ '^[a-z][a-z0-9_.:-]{1,79}$'),
  resource_type text not null check (resource_type ~ '^[a-z][a-z0-9_]{1,39}$'),
  resource_id uuid not null,
  created_at timestamptz not null default clock_timestamp()
);
create index audit_resource on gethired_private.audit_events(resource_type, resource_id, created_at);
create function gethired_private.reject_audit_change() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'Audit records are append-only'; end;
$$;
create trigger audit_immutable before update or delete or truncate on gethired_private.audit_events
for each statement execute function gethired_private.reject_audit_change();
revoke all on function gethired_private.reject_audit_change() from public, anon, authenticated;
revoke all on gethired_private.audit_events from public, anon, authenticated, gethired_runtime;
grant insert (actor_id, request_id, action, resource_type, resource_id) on gethired_private.audit_events to gethired_runtime;

create table gethired_private.outbox (
  id uuid primary key default gen_random_uuid(),
  topic text not null check (topic ~ '^[a-z][a-z0-9_.:-]{1,79}$'),
  resource_id uuid not null,
  dedupe_key uuid not null unique,
  created_at timestamptz not null default clock_timestamp(),
  available_at timestamptz not null default clock_timestamp(),
  attempts integer not null default 0 check (attempts between 0 and 10),
  lease_token uuid,
  leased_until timestamptz,
  completed_at timestamptz
);
create index outbox_pending on gethired_private.outbox(available_at) where completed_at is null and attempts < 10;
revoke all on gethired_private.outbox from public, anon, authenticated, gethired_runtime;
grant insert (topic, resource_id, dedupe_key) on gethired_private.outbox to gethired_runtime;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'gethired_outbox_worker') then
    create role gethired_outbox_worker nologin nosuperuser nocreatedb nocreaterole noinherit;
  end if;
end $$;
grant usage on schema gethired_private to gethired_outbox_worker;

create function gethired_private.claim_outbox(p_limit integer default 20)
returns table(id uuid, topic text, resource_id uuid, lease_token uuid, attempts integer)
language plpgsql security definer set search_path = '' as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then raise exception 'Invalid batch size'; end if;
  return query with pending as (
    select o.id from gethired_private.outbox o
    where o.completed_at is null and o.attempts < 10 and o.available_at <= clock_timestamp()
      and (o.leased_until is null or o.leased_until <= clock_timestamp())
    order by o.available_at, o.id limit p_limit for update skip locked
  ) update gethired_private.outbox o
    set lease_token = gen_random_uuid(), leased_until = clock_timestamp() + interval '5 minutes', attempts = o.attempts + 1
    from pending p where o.id = p.id
    returning o.id, o.topic, o.resource_id, o.lease_token, o.attempts;
end;
$$;
create function gethired_private.finish_outbox(p_id uuid, p_lease uuid, p_success boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_success is null then raise exception 'Missing outcome'; end if;
  update gethired_private.outbox set
    completed_at = case when p_success then clock_timestamp() else null end,
    available_at = clock_timestamp() + interval '1 minute' * least(attempts * attempts, 60),
    leased_until = null, lease_token = null
    where id = p_id and lease_token = p_lease and leased_until > clock_timestamp() and completed_at is null;
  return found;
end;
$$;
revoke all on function gethired_private.claim_outbox(integer), gethired_private.finish_outbox(uuid, uuid, boolean)
  from public, anon, authenticated, gethired_runtime, gethired_maintenance;
grant execute on function gethired_private.claim_outbox(integer), gethired_private.finish_outbox(uuid, uuid, boolean)
  to gethired_outbox_worker;
insert into gethired_private.schema_versions(version) values ('202610120001');
commit;
