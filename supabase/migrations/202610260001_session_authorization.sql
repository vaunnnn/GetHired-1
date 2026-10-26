-- Operator migration after B6. Uses existing table/bridge privileges; no new public API.
begin;

-- Liveness must use the current clock, including after lock waits/provider calls.
create or replace function gethired_private.provider_session_live(p_session uuid, p_user uuid)
returns boolean language sql volatile security definer set search_path = '' as $$
  select exists (
    select 1 from auth.sessions s join auth.users u on u.id = s.user_id
    where s.id = p_session and s.user_id = p_user
      and (s.not_after is null or s.not_after > clock_timestamp())
      and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until <= clock_timestamp())
      and exists (select 1 from auth.refresh_tokens r where r.session_id = s.id and not r.revoked)
  );
$$;

-- INVOKER: executes with existing runtime grants. The existing narrow bridges
-- acquire the account lock and read provider liveness. Account always precedes session.
create function gethired_private.authorize_session(
  p_session uuid, p_user uuid, p_shared boolean, p_touch boolean default false
) returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare
  target_account uuid;
  a gethired_private.accounts%rowtype;
  s gethired_private.sessions%rowtype;
  p gethired_private.student_profiles%rowtype;
  checked_at timestamptz;
  idle interval;
  projection jsonb;
begin
  if p_shared and p_touch then raise exception 'Shared authorization cannot update activity'; end if;
  select account_id into target_account from gethired_private.sessions where id = p_session;
  if target_account is null then return jsonb_build_object('error', 'SESSION_EXPIRED'); end if;
  perform gethired_private.lock_account(target_account);
  select * into a from gethired_private.accounts where id = target_account;
  if not found or a.status <> 'active' or a.credentials_blocked then
    return jsonb_build_object('error', 'SESSION_EXPIRED');
  end if;
  if p_shared then
    select * into s from gethired_private.sessions where id = p_session for share;
  else
    select * into s from gethired_private.sessions where id = p_session for update;
  end if;
  -- Separate PL/pgSQL statement: evaluation occurs AFTER acquiring both locks.
  checked_at := clock_timestamp();
  idle := case when a.role = 'student' and s.remember_me then interval '7 days' else interval '30 minutes' end;
  if s.id is null or s.account_id <> a.id or s.revoked_at is not null
    or s.expires_at <= checked_at or s.last_activity_at + idle <= checked_at then
    return jsonb_build_object('error', 'SESSION_EXPIRED');
  end if;
  if p_user is not null and a.auth_user_id is distinct from p_user then
    return jsonb_build_object('error', 'UNAUTHENTICATED');
  end if;
  if not gethired_private.provider_session_live(s.id, a.auth_user_id) then
    return jsonb_build_object('error', 'SESSION_EXPIRED');
  end if;
  if a.role = 'student' then
    select * into p from gethired_private.student_profiles where student_profiles.account_id = a.id;
    if not found then return jsonb_build_object('error', 'INVALID_CREDENTIALS'); end if;
  end if;
  projection := jsonb_build_object('id', a.id, 'role', a.role, 'displayName', a.display_name, 'email', a.email,
    'student', case when a.role = 'student' then jsonb_build_object('studentNumber', p.student_number,
      'firstName', p.first_name, 'lastName', p.last_name, 'course', p.course, 'yearLevel', p.year_level) else null end);
  if p_touch then
    update gethired_private.sessions set last_activity_at = checked_at where id = s.id;
    s.last_activity_at := checked_at;
  end if;
  return jsonb_build_object('id', a.id, 'identity', jsonb_build_object('userId', a.auth_user_id, 'sessionId', s.id),
    'user', projection, 'session', jsonb_build_object('id', s.id, 'accountId', s.account_id,
      'createdAt', s.created_at, 'expiresAt', s.expires_at, 'lastActivityAt', s.last_activity_at,
      'rememberMe', s.remember_me, 'revokedAt', s.revoked_at));
end;
$$;
revoke all on function gethired_private.authorize_session(uuid, uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function gethired_private.authorize_session(uuid, uuid, boolean, boolean) to gethired_runtime;
insert into gethired_private.schema_versions(version) values ('202610260001');
commit;
