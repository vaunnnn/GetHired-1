begin;
alter table gethired_private.companies
  add column if not exists verified boolean not null default true,
  add column if not exists verified_on text check (verified_on is null or length(verified_on) <= 120);
insert into gethired_private.schema_versions(version) values ('202611100001')
  on conflict (version) do nothing;
commit;
