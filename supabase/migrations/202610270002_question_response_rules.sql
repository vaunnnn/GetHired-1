-- Apply after 202610270001 as the database operator.
begin;

-- Preserve old incomplete content as inactive drafts rather than invent rubrics.
update gethired_private.questions
set status = 'inactive', updated_at = clock_timestamp()
where response_definition->>'format' = 'written' and status = 'active'
  and length(btrim(feedback, E' \t\n\r')) = 0;

alter table gethired_private.questions add constraint questions_response_rules check (
  case response_definition->>'format'
    when 'multiple_choice' then type in ('Technical','Situational','Coding') and feedback = ''
    when 'written' then status = 'inactive' or length(btrim(feedback, E' \t\n\r')) > 0
    else false
  end
);

comment on column gethired_private.questions.feedback is
  'Private written-answer evaluation criteria, required before activation. Must be empty for MCQs; MCQ explanations are not allowed.';
insert into gethired_private.schema_versions(version) values ('202610270002');
commit;
