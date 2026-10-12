-- Operator setup on Supabase only, after the B4 application migration.
-- Use this dedicated bucket name, or adjust this script AND COMPANY_IMAGE_BUCKET.
begin;
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('company-images', 'company-images', true, 2097152, array['image/webp'])
on conflict (id) do nothing;
do $$ begin
  if not exists(select 1 from storage.buckets where id='company-images' and public
    and file_size_limit=2097152 and allowed_mime_types=array['image/webp']) then
    raise exception 'Review the existing company-images bucket configuration before proceeding';
  end if;
end $$;
-- Restrictive policy prevents broad existing authenticated policies from enabling
-- direct browser uploads. Public object delivery does not require SELECT policies.
drop policy if exists company_images_api_only on storage.objects;
create policy company_images_api_only on storage.objects as restrictive for all
to anon, authenticated using (bucket_id <> 'company-images') with check (bucket_id <> 'company-images');
commit;
