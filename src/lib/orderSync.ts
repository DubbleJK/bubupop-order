import { LEDGER_PASSWORD_ROW_ID } from './ledgerPassword'
import { orderWrittenAt } from './orderFormat'
import { supabase } from './supabase'
import type { OrderListItem } from '../types'

const TABLE = 'orders'
const PUBLIC_TABLE = 'orders_public'

function isMissingApi(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const text = `${error.code ?? ''} ${error.message ?? ''}`
  return text.includes('PGRST202') || text.includes('PGRST205') || text.includes('42P01') || text.includes('schema cache')
}

function orderPayload(item: OrderListItem, dateKey: string, includeMoney: boolean) {
  const payload: OrderListItem = { ...item, dateKey }
  if (!includeMoney) {
    delete payload.quoteAmount
    delete payload.paid
  }
  return payload
}

/** 오늘 날짜 키 (YYYY-MM-DD, 로컬 기준) */
export function getDateKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function normalizeAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const matched = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
    const n = matched ? Number(matched[0]) : Number.NaN
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function orderDateKey(item: { id: string; dateKey?: string }): string {
  if (item.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(item.dateKey)) return item.dateKey
  const d = orderWrittenAt(item)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function normalizeOrder(raw: OrderListItem, dateKey?: string): OrderListItem {
  return {
    ...raw,
    dateKey: raw.dateKey || dateKey,
    paid: !!raw.paid,
    completed: raw.completed === true,
    quoteAmount: normalizeAmount(raw.quoteAmount),
    designImages: raw.designImages ?? [],
    orderBlocks: raw.orderBlocks ?? [],
  }
}

type OrderRowResult = { data: unknown; error: { code?: string; message?: string } | null }

/** 금액이 빠진 공개 목록을 읽고, 그 목록이 아직 없으면 기존 표를 읽는다. */
async function readOrderRows(apply: (table: string) => PromiseLike<OrderRowResult>): Promise<{
  data: unknown
  error: { code?: string; message?: string } | null
  hideMoney: boolean
}> {
  const hidden = await apply(PUBLIC_TABLE)
  if (!hidden.error) return { data: hidden.data, error: null, hideMoney: true }
  if (!isMissingApi(hidden.error)) return { data: null, error: hidden.error, hideMoney: true }
  const open = await apply(TABLE)
  return { data: open.data, error: open.error, hideMoney: false }
}

function rowsToOrders(
  data: unknown,
  hideMoney: boolean,
  extra?: (item: OrderListItem) => boolean
): OrderListItem[] {
  if (!data || !Array.isArray(data)) return []
  return data
    .map((row: { order_data: OrderListItem; date_key?: string }) =>
      row.order_data ? normalizeOrder(row.order_data, row.date_key) : null
    )
    .filter((item): item is OrderListItem => item !== null)
    .filter(item => (extra ? extra(item) : true))
    .map(item => {
      if (!hideMoney) return item
      const next = { ...item }
      delete next.quoteAmount
      delete next.paid
      return next
    })
}

/** 해당 날짜의 발주서 목록 조회 */
export async function fetchOrdersForDate(dateKey: string): Promise<OrderListItem[]> {
  if (!supabase) return []
  const { data, error, hideMoney } = await readOrderRows(table =>
    supabase!
      .from(table)
      .select('order_data, date_key')
      .eq('date_key', dateKey)
      .neq('id', LEDGER_PASSWORD_ROW_ID)
      .order('created_at', { ascending: true })
  )
  if (error) {
    console.warn('[orderSync] fetch error', error)
    return []
  }
  return rowsToOrders(data, hideMoney)
}

function daysAgoKey(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** 완료하지 않은 발주서. 최근 180일 */
export async function fetchOpenOrders(): Promise<{ orders: OrderListItem[]; error: boolean }> {
  if (!supabase) return { orders: [], error: false }
  const { data, error, hideMoney } = await readOrderRows(table =>
    supabase!
      .from(table)
      .select('order_data, date_key')
      .gte('date_key', daysAgoKey(180))
      .neq('id', LEDGER_PASSWORD_ROW_ID)
      .order('date_key', { ascending: true })
      .order('created_at', { ascending: true })
  )
  if (error) {
    console.warn('[orderSync] fetch open error', error)
    return { orders: [], error: true }
  }
  return { orders: rowsToOrders(data, hideMoney, item => !item.completed), error: false }
}

function monthOrdersFromRows(data: unknown): OrderListItem[] {
  return rowsToOrders(data, false)
}

/** 해당 월(YYYY-MM)의 발주서. 비밀번호가 맞을 때만 금액이 포함된다. */
export async function fetchOrdersForMonth(
  monthKey: string,
  password: string
): Promise<{ orders: OrderListItem[]; error: boolean }> {
  if (!supabase) return { orders: [], error: false }
  const secure = await supabase.rpc('fetch_ledger', { pw: password, month_key: monthKey })
  if (!secure.error) {
    const rows = Array.isArray(secure.data) ? secure.data : []
    return { orders: monthOrdersFromRows(rows), error: false }
  }
  if (!isMissingApi(secure.error)) {
    console.warn('[orderSync] fetch month error', secure.error)
    return { orders: [], error: true }
  }
  const [year, month] = monthKey.split('-').map(Number)
  const start = `${monthKey}-01`
  const next = new Date(year, month, 1)
  const end = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`
  const { data, error } = await supabase
    .from(TABLE)
    .select('order_data, date_key')
    .gte('date_key', start)
    .lt('date_key', end)
    .neq('id', LEDGER_PASSWORD_ROW_ID)
    .order('date_key', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    console.warn('[orderSync] fetch month error', error)
    return { orders: [], error: true }
  }
  return { orders: monthOrdersFromRows(data), error: false }
}

/** 서버 목록과 화면에 있는 발주서를 한 달 기준으로 합친다. 같은 건은 화면 내용을 남긴다. */
export function mergeMonthOrders(
  serverOrders: OrderListItem[],
  localOrders: OrderListItem[],
  monthKey: string
): OrderListItem[] {
  const inMonth = (item: OrderListItem) => orderDateKey(item).startsWith(monthKey)
  const map = new Map<string, OrderListItem>()
  serverOrders.filter(inMonth).forEach(item => map.set(item.id, item))
  localOrders.filter(inMonth).forEach(item => {
    const prev = map.get(item.id)
    const merged = { ...prev, ...item, dateKey: orderDateKey(item) }
    if (item.quoteAmount === undefined && prev?.quoteAmount != null) merged.quoteAmount = prev.quoteAmount
    if (item.paid === undefined && prev) merged.paid = prev.paid
    map.set(item.id, merged)
  })
  return Array.from(map.values()).sort((a, b) => orderDateKey(a).localeCompare(orderDateKey(b)) || a.id.localeCompare(b.id))
}

export type MoneyWrite = {
  quoteAmount?: number | null
  paid?: boolean
}

/** 금액은 별도 저장소에 둔다. 넘긴 항목만 바꾸고, 빠뜨린 항목은 유지한다. */
export async function saveOrderAmount(id: string, write: MoneyWrite): Promise<boolean> {
  if (!supabase) return true
  const touchAmount = Object.prototype.hasOwnProperty.call(write, 'quoteAmount')
  const touchPaid = Object.prototype.hasOwnProperty.call(write, 'paid')
  if (!touchAmount && !touchPaid) return true
  const partial = await supabase.rpc('save_order_money', {
    order_id: id,
    amount: touchAmount ? write.quoteAmount ?? null : null,
    is_paid: touchPaid ? !!write.paid : false,
    touch_amount: touchAmount,
    touch_paid: touchPaid,
  })
  if (!partial.error) return true
  if (!(isMissingApi(partial.error) && touchAmount && touchPaid)) {
    console.warn('[orderSync] money error', partial.error)
    return false
  }
  const legacy = await supabase.rpc('save_order_money', {
    order_id: id,
    amount: write.quoteAmount ?? null,
    is_paid: !!write.paid,
  })
  if (!legacy.error) return true
  console.warn('[orderSync] money error', legacy.error)
  return false
}

/** 발주서 한 건 저장. 서버 저장이 실패하면 false */
export async function insertOrder(dateKey: string, item: OrderListItem): Promise<boolean> {
  if (!supabase) return true
  const { error } = await supabase.from(TABLE).insert({
    id: item.id,
    date_key: dateKey,
    order_data: orderPayload(item, dateKey, false),
  })
  if (error) {
    console.warn('[orderSync] insert error', error)
    return false
  }
  return saveOrderAmount(item.id, { quoteAmount: item.quoteAmount ?? null, paid: !!item.paid })
}

/** 견적 금액·입금 여부 등 발주서 내용 수정. 서버 저장이 실패하면 false */
export async function updateOrder(item: OrderListItem, options?: { includeMoney?: boolean }): Promise<boolean> {
  if (!supabase) return true
  const dateKey = orderDateKey(item)
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      date_key: dateKey,
      order_data: orderPayload(item, dateKey, false),
    })
    .eq('id', item.id)
    .select('id')
  if (error || !data?.length) {
    console.warn('[orderSync] update error', error)
    return false
  }
  if (options?.includeMoney === false) return true
  return saveOrderAmount(item.id, { quoteAmount: item.quoteAmount ?? null, paid: !!item.paid })
}

/** 서버에 발주서 표가 응답하는지 확인 */
export async function pingOrders(): Promise<boolean> {
  if (!supabase) return false
  const hidden = await supabase.from(PUBLIC_TABLE).select('id').limit(1)
  if (!hidden.error) return true
  if (!isMissingApi(hidden.error)) return false
  const { error } = await supabase.from(TABLE).select('id').limit(1)
  return !error
}

/** 발주서 한 건 삭제. 서버 삭제가 실패하면 false */
export async function deleteOrder(id: string): Promise<boolean> {
  if (!supabase) return true
  const { data, error } = await supabase.from(TABLE).delete().eq('id', id).select('id')
  if (error || !data?.length) {
    console.warn('[orderSync] delete error', error)
    return false
  }
  return true
}

/** 해당 날짜 발주서 전체 삭제 */
export async function deleteAllForDate(dateKey: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from(TABLE).delete().eq('date_key', dateKey).select('id')
  if (error) console.warn('[orderSync] deleteAll error', error)
}
