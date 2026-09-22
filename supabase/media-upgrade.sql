-- Bleris Cakes and Pastries — media upgrade
-- Run this ONCE in the SQL Editor, after supabase/setup.sql has already been run.
-- It adds support for uploading a short video clip (or a photo) for a product,
-- stored directly in Supabase Storage, and lets the site know which kind of
-- media each product has so it can render an <img> or a <video> correctly.

-- 1. Track whether a product's media is a photo or a video.
alter table products add column if not exists media_type text not null default 'image';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_media_type_check'
  ) then
    alter table products
      add constraint products_media_type_check check (media_type in ('image', 'video'));
  end if;
end $$;

-- 2. Storage bucket for uploaded photos/videos. Public so the site can show
-- them without needing to sign every URL. The Supabase Free plan already caps
-- every upload at 50 MB, which comfortably covers a ~30 second video clip.
insert into storage.buckets (id, name, public)
values ('product-media', 'product-media', true)
on conflict (id) do update set public = true;

-- 3. Access control: anyone can view files in this bucket (needed for the
-- public site), but only a signed-in user (you) can upload, replace, or
-- delete files.
drop policy if exists "Public can view product media" on storage.objects;
create policy "Public can view product media"
  on storage.objects for select
  using (bucket_id = 'product-media');

drop policy if exists "Authenticated users manage product media" on storage.objects;
create policy "Authenticated users manage product media"
  on storage.objects for all
  using (bucket_id = 'product-media' and auth.role() = 'authenticated')
  with check (bucket_id = 'product-media' and auth.role() = 'authenticated');
