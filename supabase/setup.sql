-- Bleris Cakes and Pastries — Supabase setup script
-- Run this once in your Supabase project's SQL Editor (Project > SQL Editor > New query).
-- It creates the products table, locks it down with row-level security,
-- and seeds it with every product already on the live site so the admin
-- panel has something to edit, remove, and update prices on immediately.

create table if not exists products (
  id text primary key,
  name text not null,
  price numeric not null default 0,
  image text,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row Level Security: anyone can READ active/inactive rows (the site needs
-- this to render prices), but only a signed-in user (you, the owner) can
-- insert/update/delete. The public anon key is safe to expose in the
-- website's JS — RLS is what actually protects writes, not key secrecy.
alter table products enable row level security;

drop policy if exists "Public can read products" on products;
create policy "Public can read products"
  on products for select
  using (true);

drop policy if exists "Authenticated users manage products" on products;
create policy "Authenticated users manage products"
  on products for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Keep updated_at current on every edit.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_set_updated_at on products;
create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

-- Seed with every product currently hardcoded in index.html.
-- Safe to re-run: existing ids are left untouched (on conflict do nothing).
insert into products (id, name, price, image) values
  ('201', 'Celebration Masterpiece', 35000, 'assets/pic1.jpg'),
  ('202', '15k money bouquet', 25000, 'assets/pic2.jpg'),
  ('203', 'Chocolate bouquet', 15000, 'assets/pic3.jpg'),
  ('204', 'vanilla cloud cake', 7000, 'assets/pic4.jpg'),
  ('206', 'Event Ready', 165000, 'assets/pic6.jpg'),
  ('101', 'Classic Celebration', 35000, 'assets/pic7.jpg'),
  ('102', 'Soft Floral cloud cake', 50000, 'assets/pic8.jpg'),
  ('103', 'Dessert Table Mood', 12500, 'assets/pic9.jpg'),
  ('104', 'Tall Signature Cake', 12500, 'assets/pic10.jpg'),
  ('106', 'Hand-Finished Layer', 0, 'assets/pic12.jpg'),
  ('108', 'Mixed Selection', 130000, 'assets/pic14.jpg'),
  ('109', 'Little princess Combo', 10000, 'assets/pic15.jpg'),
  ('110', 'Custom Showcase', 1500, 'assets/pic16.jpg'),
  ('111', 'Event Arrangement', 50000, 'assets/pic17.jpg'),
  ('112', 'Decorated Detail', 15000, 'assets/pic18.jpg'),
  ('113', 'Bakery Presentation', 10000, 'assets/pic19.jpg'),
  ('114', 'Signature Design', 20000, 'assets/pic21.jpg'),
  ('115', 'Fresh Decor', 65000, 'assets/pic22.jpg'),
  ('116', 'Ready for Pickup', 25000, 'assets/pic23.jpg'),
  ('117', 'Soft cream delight', 15000, 'assets/pic25.jpg'),
  ('1', 'Chocolate Fudge Cake', 15000, 'assets/cake2.jpeg'),
  ('2', 'Red Velvet Cake', 25000, 'assets/cake3.jpeg'),
  ('3', 'New York Cheesecake', 10000, 'assets/cake4.jpeg'),
  ('4', 'Assorted Cupcakes (6)', 10000, 'assets/cake1.jpeg'),
  ('5', 'French Pastries Assortment', 15000, 'assets/cake5.jpeg'),
  ('6', 'Fresh Fruit Tart', 15000, 'assets/cake6.jpeg'),
  ('8', 'Decorated Red Velvet Cake', 7000, 'assets/cake10.jpeg'),
  ('9', 'Cheesecake Selection', 15000, 'assets/cake11.jpeg'),
  ('10', 'Assorted Cupcakes Deluxe', 18000, 'assets/cake12.jpeg'),
  ('11', 'French Pastries Assortment', 15000, 'assets/cake13.jpeg'),
  ('12', 'Fresh Fruit Tart', 25000, 'assets/cake14.jpeg'),
  ('13', 'Soft Love Combo', 100000, 'assets/boquet4.jpeg')
on conflict (id) do nothing;

-- Media support (photos or short video clips per product).
-- See media-upgrade.sql for the version of this that was shipped separately
-- for sites that had already run the section above.
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

insert into storage.buckets (id, name, public)
values ('product-media', 'product-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can view product media" on storage.objects;
create policy "Public can view product media"
  on storage.objects for select
  using (bucket_id = 'product-media');

drop policy if exists "Authenticated users manage product media" on storage.objects;
create policy "Authenticated users manage product media"
  on storage.objects for all
  using (bucket_id = 'product-media' and auth.role() = 'authenticated')
  with check (bucket_id = 'product-media' and auth.role() = 'authenticated');
