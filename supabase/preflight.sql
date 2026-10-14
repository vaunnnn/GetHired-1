-- Run with the migration operator BEFORE applying migrations to hosted Supabase.
-- Read-only: resolves the exact columns used by the provider bridge/cleanup.
begin read only;
set local statement_timeout = '5s';
select u.id, u.email, u.email_confirmed_at, u.banned_until,
       u.confirmation_token, u.recovery_token, u.confirmation_sent_at, u.recovery_sent_at,
       s.id, s.user_id, s.not_after, r.session_id, r.revoked
from auth.users u join auth.sessions s on s.user_id = u.id
join auth.refresh_tokens r on r.session_id = s.id where false;
do $$ begin
  if not has_table_privilege(current_user, 'auth.users', 'SELECT')
    or not has_table_privilege(current_user, 'auth.sessions', 'SELECT')
    or not has_table_privilege(current_user, 'auth.sessions', 'DELETE')
    or not has_table_privilege(current_user, 'auth.refresh_tokens', 'SELECT')
    or not has_table_privilege(current_user, 'auth.refresh_tokens', 'DELETE') then
    raise exception 'Operator lacks required provider privileges';
  end if;
end $$;
rollback;
