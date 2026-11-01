
-- VAYO Marketplace — Database v1
-- Барои лоиҳаи нави Supabase.
-- SQL-ро дар Supabase SQL Editor иҷро кунед.

create extension if not exists pgcrypto;

-- ПРОФИЛҲО
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

-- МАҒОЗАҲО
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text not null check (length(trim(name)) > 0),
  description text,
  phone text,
  city text not null,
  district text,
  address text not null,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  logo_url text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','suspended')),
  created_at timestamptz not null default now()
);

-- МАҲСУЛОТ
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  name text not null check (length(trim(name)) > 0),
  description text,
  category text not null,
  price numeric(12,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- АКСҲОИ МАҲСУЛОТ
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  position integer not null default 0
    check (position between 0 and 9),
  unique (product_id, position)
);

-- АКСИЯҲО
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  discount_percent integer not null
    check (discount_percent between 1 and 99),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- ФАРМОИШҲО
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id),
  recipient_name text not null,
  phone text not null,
  delivery_address text not null,
  status text not null default 'pending'
    check (status in (
      'pending','confirmed','preparing',
      'shipping','delivered','cancelled'
    )),
  total numeric(12,2) not null default 0
    check (total >= 0),
  created_at timestamptz not null default now()
);

-- МАҲСУЛОТИ ФАРМОИШ
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  shop_id uuid not null references public.shops(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0)
);

-- АДМИНИСТРАТОРҲО
-- Танҳо тавассути SQL Editor / backend идора карда мешаванд.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- ФУНКСИЯИ АДМИН
create or replace function public.is_vayo_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins
    where user_id = (select auth.uid())
  );
$$;

-- ФУНКСИЯИ СОҲИБИ МАҒОЗА
create or replace function public.owns_vayo_shop(p_shop uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shops
    where id = p_shop
      and owner_id = (select auth.uid())
  );
$$;

-- ФУНКСИЯИ СОҲИБИ МАҲСУЛОТ
create or replace function public.owns_vayo_product(p_product uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.products p
    join public.shops s on s.id = p.shop_id
    where p.id = p_product
      and s.owner_id = (select auth.uid())
  );
$$;

-- ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.promotions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.admins enable row level security;

-- PROFILES
create policy "vayo profiles own read"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.is_vayo_admin());

create policy "vayo profiles own insert"
on public.profiles for insert to authenticated
with check (id = (select auth.uid()));

create policy "vayo profiles own update"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- SHOPS
create policy "vayo shops read"
on public.shops for select to anon, authenticated
using (
  status = 'approved'
  or owner_id = (select auth.uid())
  or public.is_vayo_admin()
);

create policy "vayo shops create"
on public.shops for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and status = 'pending'
);

create policy "vayo shops owner update"
on public.shops for update to authenticated
using (
  owner_id = (select auth.uid())
  or public.is_vayo_admin()
)
with check (
  public.is_vayo_admin()
  or (
    owner_id = (select auth.uid())
    and status in ('pending','approved')
  )
);

-- PRODUCTS
create policy "vayo products read"
on public.products for select to anon, authenticated
using (
  (
    active = true
    and exists (
      select 1 from public.shops s
      where s.id = shop_id and s.status = 'approved'
    )
  )
  or public.owns_vayo_shop(shop_id)
  or public.is_vayo_admin()
);

create policy "vayo products insert"
on public.products for insert to authenticated
with check (public.owns_vayo_shop(shop_id));

create policy "vayo products update"
on public.products for update to authenticated
using (
  public.owns_vayo_shop(shop_id)
  or public.is_vayo_admin()
)
with check (
  public.owns_vayo_shop(shop_id)
  or public.is_vayo_admin()
);

create policy "vayo products delete"
on public.products for delete to authenticated
using (
  public.owns_vayo_shop(shop_id)
  or public.is_vayo_admin()
);

-- PRODUCT IMAGES
create policy "vayo images read"
on public.product_images for select to anon, authenticated
using (
  exists (
    select 1 from public.products p
    join public.shops s on s.id = p.shop_id
    where p.id = product_id
      and (
        (p.active and s.status = 'approved')
        or s.owner_id = (select auth.uid())
      )
  )
  or public.is_vayo_admin()
);

create policy "vayo images insert"
on public.product_images for insert to authenticated
with check (public.owns_vayo_product(product_id));

create policy "vayo images update"
on public.product_images for update to authenticated
using (public.owns_vayo_product(product_id))
with check (public.owns_vayo_product(product_id));

create policy "vayo images delete"
on public.product_images for delete to authenticated
using (public.owns_vayo_product(product_id));

-- PROMOTIONS
create policy "vayo promotions read"
on public.promotions for select to anon, authenticated
using (
  exists (
    select 1 from public.products p
    join public.shops s on s.id = p.shop_id
    where p.id = product_id
      and (
        (p.active and s.status = 'approved')
        or s.owner_id = (select auth.uid())
      )
  )
  or public.is_vayo_admin()
);

create policy "vayo promotions insert"
on public.promotions for insert to authenticated
with check (public.owns_vayo_product(product_id));

create policy "vayo promotions update"
on public.promotions for update to authenticated
using (public.owns_vayo_product(product_id))
with check (public.owns_vayo_product(product_id));

create policy "vayo promotions delete"
on public.promotions for delete to authenticated
using (public.owns_vayo_product(product_id));

-- ORDERS: хондан танҳо аз тарафи харидор ва админ
create policy "vayo orders read"
on public.orders for select to authenticated
using (
  buyer_id = (select auth.uid())
  or public.is_vayo_admin()
);

-- ORDER ITEMS: хондан танҳо аз тарафи харидор ва админ
create policy "vayo order items read"
on public.order_items for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and o.buyer_id = (select auth.uid())
  )
  or public.is_vayo_admin()
);

-- ADMIN TABLE: танҳо админҳо хонда метавонанд
create policy "vayo admins read"
on public.admins for select to authenticated
using (public.is_vayo_admin());

-- Барои амният, фармоишҳо аз браузер мустақим
-- сохта ё тағйир дода намешаванд.
-- Дар қадами оянда RPC-и серверӣ месозем,
-- ки нарх ва миқдори молро худаш месанҷад.

-- ИНДЕКСҲО
create index if not exists vayo_shops_owner_idx
on public.shops(owner_id);

create index if not exists vayo_shops_city_idx
on public.shops(city);

create index if not exists vayo_products_shop_idx
on public.products(shop_id);

create index if not exists vayo_products_category_idx
on public.products(category);

create index if not exists vayo_promotions_product_idx
on public.promotions(product_id);

create index if not exists vayo_orders_buyer_idx
on public.orders(buyer_id);

create index if not exists vayo_order_items_order_idx
on public.order_items(order_id);
