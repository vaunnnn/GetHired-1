export const providerSchema = `do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  end $$; create schema auth;
  create table auth.users(id uuid primary key, email text unique, email_confirmed_at timestamptz, banned_until timestamptz,
    confirmation_token text, recovery_token text, confirmation_sent_at timestamptz, recovery_sent_at timestamptz);
  create table auth.sessions(id uuid primary key, user_id uuid references auth.users(id), not_after timestamptz);
  create table auth.refresh_tokens(session_id uuid references auth.sessions(id) on delete cascade, revoked boolean);`

export const migrations = [
  "202609290001_phase3_auth.sql",
  "202610050001_b2_operations.sql",
  "202610120001_b3_feature_foundation.sql",
  "202610120002_b4_companies.sql",
  "202610130001_b5_onboarding.sql",
  "202610140001_b6_question_bank.sql",
  "202610260001_session_authorization.sql",
]
