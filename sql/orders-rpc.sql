
-- VAYO secure checkout RPC
-- Requires orders, order_items, products,
-- promotions and shops tables.
--
-- Expected orders columns:
-- id, customer_id, customer_name,
-- customer_phone, city, address,
-- latitude, longitude, notes,
-- payment_method, status, total_amount
--
-- Expected order_items columns:
-- order_id, product_id, quantity, unit_price

create or replace function public.vayo_create_order(
  p_customer_name text,
  p_customer_phone text,
  p_city text,
  p_address text,
  p_latitude double precision,
  p_longitude double precision,
  p_notes text,
  p_payment_method text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid := auth.uid();
  v_order_id uuid;
  v_item jsonb;
  v_product record;
  v_product_id uuid;
  v_quantity integer;
  v_discount numeric;
  v_unit_price numeric;
  v_total numeric := 0;
  v_count integer := 0;
begin
  if v_customer is null then
    raise exception 'Барои фармоиш ворид шавед';
  end if;

  if nullif(trim(p_customer_name), '') is null
     or nullif(trim(p_customer_phone), '') is null
     or nullif(trim(p_city), '') is null
     or nullif(trim(p_address), '') is null then
    raise exception 'Маълумоти харидор нопурра аст';
  end if;

  if p_latitude is null or p_longitude is null
     or p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Координатаҳо нодурустанд';
  end if;

  if p_payment_method is distinct from 'cash' then
    raise exception 'Ҳоло танҳо пардохти нақдӣ фаъол аст';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 50 then
    raise exception 'Сабади харид нодуруст аст';
  end if;

  -- Reject duplicate products to prevent stock bypass.
  if (
    select count(*) <> count(distinct item->>'product_id')
    from jsonb_array_elements(p_items) as item
  ) then
    raise exception 'Маҳсулоти такрорӣ дар сабад ҳаст';
  end if;

  -- Lock product rows in a stable order.
  perform 1
  from public.products p
  where p.id in (
    select (item->>'product_id')::uuid
    from jsonb_array_elements(p_items) as item
  )
  order by p.id
  for update;

  -- First validate and calculate everything.
  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;

    if (v_item->>'quantity') !~ '^[0-9]+$' then
      raise exception 'Миқдори маҳсулот нодуруст аст';
    end if;

    v_quantity := (v_item->>'quantity')::integer;

    if v_quantity < 1 or v_quantity > 1000 then
      raise exception 'Миқдор бояд аз 1 то 1000 бошад';
    end if;

    select p.id, p.price, p.stock
    into v_product
    from public.products p
    join public.shops s on s.id = p.shop_id
    where p.id = v_product_id
      and p.active = true
      and s.status = 'approved';

    if not found then
      raise exception 'Маҳсулот дастрас нест';
    end if;

    if v_product.stock < v_quantity then
      raise exception 'Миқдори мол дар анбор кофӣ нест';
    end if;

    select coalesce(max(pr.discount_percent), 0)
    into v_discount
    from public.promotions pr
    where pr.product_id = v_product_id
      and pr.starts_at <= now()
      and pr.ends_at > now()
      and pr.discount_percent > 0
      and pr.discount_percent < 100;

    v_unit_price := round(
      v_product.price * (1 - v_discount / 100),
      2
    );

    v_total := v_total + v_unit_price * v_quantity;
    v_count := v_count + 1;
  end loop;

  -- Insert order.
  insert into public.orders (
    customer_id,
    customer_name,
    customer_phone,
    city,
    address,
    latitude,
    longitude,
    notes,
    payment_method,
    status,
    total_amount
  )
  values (
    v_customer,
    trim(p_customer_name),
    trim(p_customer_phone),
    trim(p_city),
    trim(p_address),
    p_latitude,
    p_longitude,
    coalesce(p_notes, ''),
    'cash',
    'pending',
    v_total
  )
  returning id into v_order_id;

  -- Insert items and decrement stock.
  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    select p.price
    into v_unit_price
    from public.products p
    where p.id = v_product_id;

    select coalesce(max(pr.discount_percent), 0)
    into v_discount
    from public.promotions pr
    where pr.product_id = v_product_id
      and pr.starts_at <= now()
      and pr.ends_at > now()
      and pr.discount_percent > 0
      and pr.discount_percent < 100;

    v_unit_price := round(
      v_unit_price * (1 - v_discount / 100),
      2
    );

    insert into public.order_items (
      order_id,
      product_id,
      quantity,
      unit_price
    )
    values (
      v_order_id,
      v_product_id,
      v_quantity,
      v_unit_price
    );

    update public.products
    set stock = stock - v_quantity
    where id = v_product_id
      and stock >= v_quantity;

    if not found then
      raise exception 'Анбор тағйир ёфт, дубора кӯшиш кунед';
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'total_amount', v_total,
    'items_count', v_count
  );
end;
$$;

revoke all on function public.vayo_create_order(
  text,text,text,text,
  double precision,double precision,
  text,text,jsonb
) from public, anon;

grant execute on function public.vayo_create_order(
  text,text,text,text,
  double precision,double precision,
  text,text,jsonb
) to authenticated;
