import type { OrderListItem } from '../types'

export type ListLane = 'print' | 'final'

export function listLaneOf(item: OrderListItem): ListLane {
  return item.listLane === 'final' ? 'final' : 'print'
}

function byRank(items: OrderListItem[]): OrderListItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const left = a.item.listRank
      const right = b.item.listRank
      if (typeof left === 'number' && typeof right === 'number' && left !== right) return left - right
      if (typeof left === 'number') return -1
      if (typeof right === 'number') return 1
      return a.index - b.index
    })
    .map(row => row.item)
}

export function splitOrderLanes(items: OrderListItem[]): { print: OrderListItem[]; final: OrderListItem[] } {
  const print: OrderListItem[] = []
  const final: OrderListItem[] = []
  items.forEach(item => (listLaneOf(item) === 'final' ? final : print).push(item))
  return { print: byRank(print), final: byRank(final) }
}

/** 한 건을 인쇄 목록 또는 최종 목록의 원하는 위치로 옮긴다. 자리가 그대로면 null */
export function moveOrder(items: OrderListItem[], id: string, lane: ListLane, index: number): OrderListItem[] | null {
  const { print, final } = splitOrderLanes(items)
  const fromLane: ListLane = print.some(item => item.id === id) ? 'print' : 'final'
  const from = fromLane === 'print' ? print : final
  const fromIndex = from.findIndex(item => item.id === id)
  if (fromIndex < 0) return null
  let toIndex = index
  if (fromLane === lane && fromIndex < toIndex) toIndex -= 1
  toIndex = Math.max(0, toIndex)
  if (fromLane === lane && fromIndex === toIndex) return null
  const moving = from[fromIndex]
  const nextPrint = print.filter(item => item.id !== id)
  const nextFinal = final.filter(item => item.id !== id)
  const dest = lane === 'print' ? nextPrint : nextFinal
  dest.splice(Math.min(toIndex, dest.length), 0, moving)
  const ranked = new Map<string, OrderListItem>()
  nextPrint.forEach((item, rank) => ranked.set(item.id, { ...item, listLane: 'print', listRank: rank }))
  nextFinal.forEach((item, rank) => ranked.set(item.id, { ...item, listLane: 'final', listRank: rank }))
  return items.map(item => ranked.get(item.id) ?? item)
}
