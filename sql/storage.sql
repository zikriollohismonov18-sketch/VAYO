
-- VAYO: Product Image Storage
-- File: sql/storage.sql

-- 1. Public bucket for product photos
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. Upload only into own shop/product folder
-- Path: shop_id/product_id/random-filename.jpg

create policy "vayo storage upload own products"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.products p
    join public.shops s on s.id = p.shop_id
    where s.owner_id = (select auth.uid())
      and s.id::text = (storage.foldername(name))[1]
      and p.id::text = (storage.foldername(name))[2]
  )
);

-- 3. Owner can remove own photos
create policy "vayo storage delete own products"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.products p
    join public.shops s on s.id = p.shop_id
    where s.owner_id = (select auth.uid())
      and s.id::text = (storage.foldername(name))[1]
      and p.id::text = (storage.foldername(name))[2]
  )
);

-- 4. Owner can update own photos
create policy "vayo storage update own products"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.products p
    join public.shops s on s.id = p.shop_id
    where s.owner_id = (select auth.uid())
      and s.id::text = (storage.foldername(name))[1]
      and p.id::text = (storage.foldername(name))[2]
  )
)
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.products p
    join public.shops s on s.id = p.shop_id
    where s.owner_id = (select auth.uid())
      and s.id::text = (storage.foldername(name))[1]
      and p.id::text = (storage.foldername(name))[2]
  )
);

-- 5. Owner can list/read own storage objects.
-- Public bucket URLs remain publicly accessible.
create policy "vayo storage read own products"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.products p
    join public.shops s on s.id = p.shop_id
    where s.owner_id = (select auth.uid())
      and s.id::text = (storage.foldername(name))[1]
      and p.id::text = (storage.foldername(name))[2]
  )
);
