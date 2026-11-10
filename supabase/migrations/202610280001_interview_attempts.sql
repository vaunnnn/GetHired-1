begin;
create table gethired_private.interview_attempts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references gethired_private.accounts(id),
  category_id uuid not null references gethired_private.categories(id),
  category_name text not null,
  restarted_from uuid unique references gethired_private.interview_attempts(id),
  status text not null default 'in_progress' check (status in ('in_progress','completed','abandoned')),
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  score numeric(5,2) check (score between 0 and 100),
  check ((status='completed' and completed_at is not null and score is not null)
    or (status<>'completed' and completed_at is null and score is null))
);
create unique index interview_attempt_one_active on gethired_private.interview_attempts(account_id,category_id) where status='in_progress';
create index interview_attempt_history on gethired_private.interview_attempts(account_id,created_at desc,id desc);
create table gethired_private.attempt_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references gethired_private.interview_attempts(id),
  source_id uuid not null,
  position integer not null check (position>=0),
  phase text not null,
  phase_label text not null,
  question text not null,
  type text not null,
  hint text not null,
  rubric text not null,
  response_definition jsonb not null check (gethired_private.valid_question_response(response_definition)),
  unique(attempt_id,position),
  unique(attempt_id,source_id)
);
create table gethired_private.attempt_answers (
  question_id uuid primary key references gethired_private.attempt_questions(id),
  answer text not null default '' check (length(answer)<=20000),
  revision integer not null default 0 check (revision>=0),
  status text not null default 'draft' check (status in ('draft','evaluating','failed','evaluated')),
  score integer check (score between 0 and 100),
  feedback text check (length(feedback)<=4000),
  evaluation_token uuid,
  evaluation_started_at timestamptz,
  evaluation_model text,
  evaluation_version text,
  updated_at timestamptz not null default clock_timestamp(),
  check ((status='evaluated' and score is not null and feedback is not null)
    or (status<>'evaluated' and score is null and feedback is null))
);
-- A bounded counter per scope, reset in place; no per-keystroke or request history.
create table gethired_private.interview_evaluation_budget (
  scope text primary key,
  minute_start timestamptz not null,
  minute_count integer not null,
  day_start date not null,
  day_count integer not null
);
revoke all on gethired_private.interview_attempts,gethired_private.attempt_questions,gethired_private.attempt_answers,gethired_private.interview_evaluation_budget from public,anon,authenticated,gethired_runtime;
grant select,insert,update on gethired_private.interview_attempts,gethired_private.attempt_answers,gethired_private.interview_evaluation_budget to gethired_runtime;
grant select,insert on gethired_private.attempt_questions to gethired_runtime;
insert into gethired_private.schema_versions(version) values ('202610280001');
commit;
