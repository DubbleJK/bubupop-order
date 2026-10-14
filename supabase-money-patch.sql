-- 가계부 금액과 입금 여부를 따로 저장하게 하는 수정.
-- 이미 보안 SQL을 실행한 Supabase SQL Editor에 이 파일만 붙여 넣고 Run 하세요.
-- 발주서 본문과 기존 금액 행은 지우지 않습니다.

drop function if exists public.save_order_money(text, numeric, boolean);
drop function if exists public.save_order_money(text, numeric, boolean, boolean, boolean);

create or replace function public.save_order_money(
  order_id text,
  amount numeric default null,
  is_paid boolean default null,
  touch_amount boolean default true,
  touch_paid boolean default true
)
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
  if not touch_amount and not touch_paid then
    return;
  end if;
  insert into public.order_money (id, quote_amount, paid)
  values (
    order_id,
    case when touch_amount then amount else null end,
    case when touch_paid then coalesce(is_paid, false) else false end
  )
  on conflict (id) do update
  set quote_amount = case when touch_amount then excluded.quote_amount else public.order_money.quote_amount end,
      paid = case when touch_paid then excluded.paid else public.order_money.paid end;
end;
$$;

revoke all on function public.save_order_money(text, numeric, boolean, boolean, boolean) from public;
grant execute on function public.save_order_money(text, numeric, boolean, boolean, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
