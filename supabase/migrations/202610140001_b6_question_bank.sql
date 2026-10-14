begin;
create table gethired_private.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  description text not null check (length(description) <= 2000),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  bg text not null check (bg ~ '^#[0-9a-fA-F]{6}$'),
  phases jsonb not null check (jsonb_typeof(phases) = 'array' and jsonb_array_length(phases) between 1 and 8),
  status text not null default 'active' check (status in ('active','inactive')),
  updated_at timestamptz not null default clock_timestamp()
);
create table gethired_private.questions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references gethired_private.categories(id),
  question text not null check (length(question) between 1 and 12000),
  type text not null check (type in ('Introduction','Technical','Behavioral','Situational','Motivational','Coding','Design Challenge','Candidate Questions')),
  hint text not null check (length(hint) <= 4000),
  feedback text not null check (length(feedback) <= 12000),
  status text not null default 'active' check (status in ('active','inactive')),
  updated_at timestamptz not null default clock_timestamp()
);
create index questions_category on gethired_private.questions(category_id, status, type);
revoke all on gethired_private.categories, gethired_private.questions from public, anon, authenticated, gethired_runtime;
grant select, insert, update on gethired_private.categories, gethired_private.questions to gethired_runtime;
insert into gethired_private.schema_versions(version) values ('202610140001');
commit;
