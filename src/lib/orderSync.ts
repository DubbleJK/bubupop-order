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

/** 해당 날짜의 발주서 목록 조회 */
export async function fetchOrdersForDate(dateKey: string): Promise<OrderListItem[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from(TABLE)
    .select('order_data')
    .eq('date_key', dateKey)
    .order('created_at', { ascending: true })
  if (error) {
    console.warn('[orderSync] fetch error', error)
    return []
  }
  if (!data || !Array.isArray(data)) return []
  return data.map((row: { order_data: OrderListItem }) => row.order_data).filter(Boolean)
}

/** 발주서 한 건 저장 */
export async function insertOrder(dateKey: string, item: OrderListItem): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from(TABLE).insert({
    id: item.id,
    date_key: dateKey,
    order_data: item,
  })
  if (error) console.warn('[orderSync] insert error', error)
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
