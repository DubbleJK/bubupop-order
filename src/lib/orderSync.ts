import { orderWrittenAt } from './orderFormat'
import { supabase } from './supabase'
import type { OrderListItem } from '../types'

const TABLE = 'orders'

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
    const n = Number(value.replace(/[^\d]/g, ''))
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

/** 해당 날짜의 발주서 목록 조회 */
export async function fetchOrdersForDate(dateKey: string): Promise<OrderListItem[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from(TABLE)
    .select('order_data, date_key')
    .eq('date_key', dateKey)
    .order('created_at', { ascending: true })
  if (error) {
    console.warn('[orderSync] fetch error', error)
    return []
  }
  if (!data || !Array.isArray(data)) return []
  return data
    .map((row: { order_data: OrderListItem; date_key?: string }) =>
      row.order_data ? normalizeOrder(row.order_data, row.date_key) : null
    )
    .filter((item): item is OrderListItem => item !== null)
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
  const { data, error } = await supabase
    .from(TABLE)
    .select('order_data, date_key')
    .gte('date_key', daysAgoKey(180))
    .order('date_key', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    console.warn('[orderSync] fetch open error', error)
    return { orders: [], error: true }
  }
  if (!data || !Array.isArray(data)) return { orders: [], error: false }
  return {
    orders: data
      .map((row: { order_data: OrderListItem; date_key?: string }) =>
        row.order_data ? normalizeOrder(row.order_data, row.date_key) : null
      )
      .filter((item): item is OrderListItem => item !== null && !item.completed),
    error: false,
  }
}

/** 해당 월(YYYY-MM)의 발주서 목록. 연결 실패 시 error 가 true */
export async function fetchOrdersForMonth(monthKey: string): Promise<{ orders: OrderListItem[]; error: boolean }> {
  if (!supabase) return { orders: [], error: false }
  const [year, month] = monthKey.split('-').map(Number)
  const start = `${monthKey}-01`
  const next = new Date(year, month, 1)
  const end = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`
  const { data, error } = await supabase
    .from(TABLE)
    .select('order_data, date_key')
    .gte('date_key', start)
    .lt('date_key', end)
    .order('date_key', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    console.warn('[orderSync] fetch month error', error)
    return { orders: [], error: true }
  }
  if (!data || !Array.isArray(data)) return { orders: [], error: false }
  return {
    orders: data
      .map((row: { order_data: OrderListItem; date_key?: string }) =>
        row.order_data ? normalizeOrder(row.order_data, row.date_key) : null
      )
      .filter((item): item is OrderListItem => item !== null),
    error: false,
  }
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
  localOrders.filter(inMonth).forEach(item => map.set(item.id, { ...map.get(item.id), ...item, dateKey: orderDateKey(item) }))
  return Array.from(map.values()).sort((a, b) => orderDateKey(a).localeCompare(orderDateKey(b)) || a.id.localeCompare(b.id))
}

/** 발주서 한 건 저장 */
export async function insertOrder(dateKey: string, item: OrderListItem): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from(TABLE).insert({
    id: item.id,
    date_key: dateKey,
    order_data: { ...item, dateKey },
  })
  if (error) console.warn('[orderSync] insert error', error)
}

/** 견적 금액·입금 여부 등 발주서 내용 수정 */
export async function updateOrder(item: OrderListItem): Promise<void> {
  if (!supabase) return
  const dateKey = orderDateKey(item)
  const { error } = await supabase
    .from(TABLE)
    .update({
      date_key: dateKey,
      order_data: { ...item, dateKey },
    })
    .eq('id', item.id)
  if (error) console.warn('[orderSync] update error', error)
}

/** 발주서 한 건 삭제 */
export async function deleteOrder(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) console.warn('[orderSync] delete error', error)
}

/** 해당 날짜 발주서 전체 삭제 */
export async function deleteAllForDate(dateKey: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from(TABLE).delete().eq('date_key', dateKey)
  if (error) console.warn('[orderSync] deleteAll error', error)
}
