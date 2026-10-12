begin;
create table gethired_private.company_images (
  id uuid primary key default gen_random_uuid(),
  object_path text not null unique,
  url text not null,
  state text not null default 'pending' check (state in ('pending','ready','deleting')),
  created_at timestamptz not null default clock_timestamp()
);
create table gethired_private.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 160),
  industry text not null check (length(industry) between 1 and 120),
  type text not null check (length(type) between 1 and 120),
  specializations text[] not null check (cardinality(specializations) between 1 and 30),
  location text not null check (length(location) between 1 and 250),
  slots integer not null check (slots between 0 and 100000),
  description text not null check (length(description) <= 5000),
  image_id uuid references gethired_private.company_images(id),
  website text not null, email text not null, phone text not null, hours text not null,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index companies_listing on gethired_private.companies(status, lower(name), id);
create index companies_image on gethired_private.companies(image_id);
create table gethired_private.bookmarks (
  account_id uuid not null references gethired_private.accounts(id),
  company_id uuid not null references gethired_private.companies(id),
  created_at timestamptz not null default clock_timestamp(),
  primary key(account_id, company_id)
);
revoke all on gethired_private.companies, gethired_private.company_images, gethired_private.bookmarks from public, anon, authenticated;
grant select, insert, update on gethired_private.companies, gethired_private.company_images to gethired_runtime;
grant select, insert, delete on gethired_private.bookmarks to gethired_runtime;
-- Cleanup marks an orphan before external deletion. The API locks the same image
-- row before attachment; deleting images can never be attached.
grant select, update, delete on gethired_private.company_images to gethired_maintenance;
grant select on gethired_private.companies to gethired_maintenance;
insert into gethired_private.schema_versions(version) values ('202610120002');
commit;
