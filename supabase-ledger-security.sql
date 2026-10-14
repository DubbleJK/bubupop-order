-- 인쇄 목록 응답에서 견적 금액과 입금 여부를 빼는 설정.
-- Supabase SQL Editor에 전체를 붙여 넣고 Run 하세요.
-- 이미 배포된 앱은 이 명령을 실행하기 전에도 동작하고, 실행한 뒤부터 금액이 가려집니다.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.order_money (
  id text primary key references public.orders (id) on delete cascade,
  quote_amount numeric,
  paid boolean not null default false
);

alter table public.order_money enable row level security;
revoke all on public.order_money from anon, authenticated, public;

insert into public.order_money (id, quote_amount, paid)
select
  id,
  case
    when order_data->>'quoteAmount' is null or order_data->>'quoteAmount' = '' then null
    else (order_data->>'quoteAmount')::numeric
  end,
  coalesce((order_data->>'paid')::boolean, false)
from public.orders
where id <> '__settings_ledger_password__'
  and (order_data ? 'quoteAmount' or order_data ? 'paid')
on conflict (id) do update
set quote_amount = excluded.quote_amount,
    paid = excluded.paid;

create or replace function public.strip_order_money()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.order_data is not null then
    new.order_data = new.order_data - 'quoteAmount' - 'paid';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_strip_money on public.orders;
create trigger orders_strip_money
  before insert or update on public.orders
  for each row
  execute function public.strip_order_money();

create or replace view public.orders_public as
select
  id,
  date_key,
  created_at,
  (order_data - 'quoteAmount' - 'paid') as order_data
from public.orders
where id <> '__settings_ledger_password__';

grant select on public.orders_public to anon, authenticated;

drop policy if exists "Allow all for orders" on public.orders;
drop policy if exists "orders_insert" on public.orders;
drop policy if exists "orders_update" on public.orders;
drop policy if exists "orders_delete" on public.orders;

create policy "orders_insert"
  on public.orders
  for insert
  to anon, authenticated
  with check (id <> '__settings_ledger_password__');

create policy "orders_update"
  on public.orders
  for update
  to anon, authenticated
  using (id <> '__settings_ledger_password__')
  with check (id <> '__settings_ledger_password__');

create policy "orders_delete"
  on public.orders
  for delete
  to anon, authenticated
  using (id <> '__settings_ledger_password__');

create or replace function public.ledger_password_ok(pw text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored text;
begin
  if pw is null or pw = '' then
    return false;
  end if;
  select order_data->>'passwordHash' into stored
  from public.orders
  where id = '__settings_ledger_password__';
  if stored is null or stored = '' then
    return pw = '1000';
  end if;
  if stored ~ '^[a-f0-9]{64}$' then
    return stored = encode(extensions.digest(convert_to(pw, 'utf8'), 'sha256'), 'hex');
  end if;
  return stored = pw;
end;
$$;

create or replace function public.check_ledger_password(pw text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.ledger_password_ok(pw);
end;
$$;

create or replace function public.set_ledger_password(current_pw text, new_pw text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_pw is null or length(btrim(new_pw)) = 0 then
    raise exception 'empty password';
  end if;
  if not public.ledger_password_ok(current_pw) then
    raise exception 'invalid password';
  end if;
  insert into public.orders (id, date_key, order_data)
  values (
    '__settings_ledger_password__',
    '1970-01-01',
    jsonb_build_object(
      'passwordHash',
      encode(extensions.digest(convert_to(new_pw, 'utf8'), 'sha256'), 'hex')
    )
  )
  on conflict (id) do update
  set order_data = excluded.order_data,
      date_key = excluded.date_key;
end;
$$;

create or replace function public.save_order_money(order_id text, amount numeric, is_paid boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if order_id is null or order_id = '' or order_id = '__settings_ledger_password__' then
    raise exception 'invalid order';
  end if;
  if not exists (select 1 from public.orders where id = order_id) then
    raise exception 'missing order';
  end if;
  insert into public.order_money (id, quote_amount, paid)
  values (order_id, amount, coalesce(is_paid, false))
  on conflict (id) do update
  set quote_amount = excluded.quote_amount,
      paid = excluded.paid;
end;
$$;

create or replace function public.fetch_ledger(pw text, month_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.ledger_password_ok(pw) then
    raise exception 'invalid password';
  end if;
  if month_key is null or month_key !~ '^\d{4}-\d{2}$' then
    raise exception 'invalid month';
  end if;
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'date_key', o.date_key,
      'order_data',
        (o.order_data - 'quoteAmount' - 'paid')
        || jsonb_strip_nulls(jsonb_build_object('quoteAmount', m.quote_amount))
        || jsonb_build_object('paid', coalesce(m.paid, false))
    )
    order by o.date_key, o.created_at
  ), '[]'::jsonb)
  into result
  from public.orders o
  left join public.order_money m on m.id = o.id
  where o.id <> '__settings_ledger_password__'
    and o.date_key >= month_key || '-01'
    and o.date_key < to_char((to_date(month_key || '-01', 'YYYY-MM-DD') + interval '1 month')::date, 'YYYY-MM-DD');
  return result;
end;
$$;

revoke all on function public.ledger_password_ok(text) from public, anon, authenticated;
revoke all on function public.check_ledger_password(text) from public;
revoke all on function public.set_ledger_password(text, text) from public;
revoke all on function public.save_order_money(text, numeric, boolean) from public;
revoke all on function public.fetch_ledger(text, text) from public;

grant execute on function public.check_ledger_password(text) to anon, authenticated;
grant execute on function public.set_ledger_password(text, text) to anon, authenticated;
grant execute on function public.save_order_money(text, numeric, boolean) to anon, authenticated;
grant execute on function public.fetch_ledger(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
