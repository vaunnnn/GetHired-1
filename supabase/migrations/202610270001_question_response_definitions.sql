-- Additive question-bank foundation. Apply as the database operator after B6.
-- Existing API fields remain compatible; response configuration is wired into
-- question CRUD and the student renderer in the next implementation task.
begin;

create function gethired_private.valid_question_response(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  option jsonb;
  ids text[] := '{}';
  labels text[] := '{}';
  option_id text;
  option_label text;
begin
  if value is null or jsonb_typeof(value) <> 'object' then return false; end if;
  if value->>'format' = 'written' then
    return value = '{"format":"written"}'::jsonb;
  end if;
  if value->>'format' is distinct from 'multiple_choice'
    or not (value ?& array['format','options','correctOptionId'])
    or (value - array['format','options','correctOptionId']) <> '{}'::jsonb
    or jsonb_typeof(value->'options') is distinct from 'array'
    or jsonb_typeof(value->'correctOptionId') is distinct from 'string'
  then return false; end if;
  if jsonb_array_length(value->'options') not between 2 and 6 then return false; end if;
  for option in select * from jsonb_array_elements(value->'options') loop
    if jsonb_typeof(option) is distinct from 'object'
      or not (option ?& array['id','text'])
      or (option - array['id','text']) <> '{}'::jsonb
      or jsonb_typeof(option->'id') is distinct from 'string'
      or jsonb_typeof(option->'text') is distinct from 'string'
    then return false; end if;
    option_id := option->>'id';
    option_label := lower(btrim(option->>'text', E' \t\n\r'));
    if option_id !~ '^[a-z][a-z0-9_-]{0,39}$'
      or length(option_label) not between 1 and 1000
      or option_id = any(ids) or option_label = any(labels)
    then return false; end if;
    ids := array_append(ids, option_id);
    labels := array_append(labels, option_label);
  end loop;
  return value->>'correctOptionId' = any(ids);
end;
$$;

revoke all on function gethired_private.valid_question_response(jsonb) from public, anon, authenticated;
grant execute on function gethired_private.valid_question_response(jsonb) to gethired_runtime;

alter table gethired_private.questions
  add column response_definition jsonb not null default '{"format":"written"}'::jsonb,
  add constraint questions_response_definition_valid
    check (gethired_private.valid_question_response(response_definition));

comment on column gethired_private.questions.response_definition is
  'Private answer format configuration. Multiple choice stores 2-6 options and one correctOptionId. Never expose the answer key to students.';
comment on column gethired_private.questions.feedback is
  'Private written-answer evaluation criteria or MCQ explanation. Blank legacy rubrics need review before evaluation. Not generated student feedback.';

insert into gethired_private.schema_versions(version) values ('202610270001');
commit;
