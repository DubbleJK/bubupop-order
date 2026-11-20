import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { deliveryView, formatKoreanDate, formatOrderText, orderWrittenAt, scheduledDueDay } from './lib/orderFormat'
import { orderDateKey } from './lib/orderSync'
import { splitOrderLanes, type ListLane } from './lib/orderLanes'
import type { OrderListItem } from './types'
import styles from './App.module.css'

function writtenLabel(item: OrderListItem): string {
  const [, month, day] = orderDateKey(item).split('-')
  return `${Number(month)}월 ${Number(day)}일`
}

function dueLineOf(item: OrderListItem): { text: string; urgent: boolean } {
  const view = deliveryView(item)
  const due = scheduledDueDay(item)
  if (!due) return { text: view.display, urgent: view.urgent }
  const date = formatKoreanDate(due).replace(/^\d{4}년\s*/, '')
  return { text: `${view.urgent ? '당일/긴급' : '납기'} ${date}`, urgent: view.urgent }
}

function OrderLane({
  lane,
  title,
  items,
  emptyText,
  selectedIds,
  expandedId,
  editingId,
  draggingId,
  dropIndex,
  onToggleSelected,
  onToggleExpanded,
  onProof,
  onEdit,
  onComplete,
  onDelete,
  onDragStart,
}: {
  lane: ListLane
  title: string
  items: OrderListItem[]
  emptyText?: string
  selectedIds: string[]
  expandedId: string | null
  editingId: string | null
  draggingId: string | null
  dropIndex: number | null
  onToggleSelected: (id: string) => void
  onToggleExpanded: (id: string) => void
  onProof: (item: OrderListItem) => void
  onEdit: (item: OrderListItem) => void
  onComplete: (item: OrderListItem) => void
  onDelete: (id: string) => void
  onDragStart: (event: ReactPointerEvent<HTMLButtonElement>, id: string) => void
}) {
  return (
    <div className={styles.orderLane} data-lane={lane}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {items.length === 0 ? (
        <p className={`${styles.orderListEmptyDrop} ${dropIndex === 0 ? styles.orderListDropEnd : ''}`}>{emptyText}</p>
      ) : (
        <ul className={`${styles.orderList} ${dropIndex === items.length ? styles.orderListDropEnd : ''}`}>
          {items.map((item, index) => (
            <li
              key={item.id}
              className={`${styles.orderListItem} ${draggingId === item.id ? styles.orderListItemDragging : ''} ${dropIndex === index ? styles.orderListItemBefore : ''}`}
              data-order-row
              data-lane={lane}
              data-index={index}
            >
              <label className={styles.printCheck}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => onToggleSelected(item.id)}
                />
              </label>
              <button
                type="button"
                className={styles.orderListSummary}
                aria-expanded={expandedId === item.id}
                onClick={() => onToggleExpanded(item.id)}
              >
                <span className={styles.orderListMain}>
                  <span className={styles.orderListDate}>{writtenLabel(item)}</span>
                  {editingId === item.id ? <span className={styles.editMark}>수정 중</span> : null}
                  {index + 1}. {item.ordererName || '(주문자 없음)'} - {item.orderProduct}
                </span>
                <span className={dueLineOf(item).urgent ? styles.orderListDueUrgent : styles.orderListDue}>
                  <span>{dueLineOf(item).text}</span>
                  <span className={styles.orderListToggle}>{expandedId === item.id ? '접기' : '보기'}</span>
                </span>
              </button>
              <span className={styles.orderListItemActions}>
                <button type="button" className={styles.orderListProofBtn} onClick={() => onProof(item)}>
                  시안
                </button>
                {item.orderBlocks?.length > 0 && (
                  <button type="button" className={styles.orderListEditBtn} onClick={() => onEdit(item)}>
                    수정
                  </button>
                )}
                <button type="button" className={styles.orderListDoneBtn} onClick={() => onComplete(item)}>
                  완료
                </button>
                <button type="button" className={styles.orderListDeleteBtn} onClick={() => onDelete(item.id)}>
                  삭제
                </button>
              </span>
              <button
                type="button"
                className={styles.orderDrag}
                aria-label="순서 바꾸기"
                onPointerDown={event => onDragStart(event, item.id)}
              >
                ⠿
              </button>
              {expandedId === item.id && (
                <div className={styles.orderListDetail}>
                  <pre className={styles.orderPreview}>
                    {item.orderBlocks?.length
                      ? formatOrderText({
                          ordererName: item.ordererName,
                          orderChannel: item.orderChannel,
                          deliveryDate: item.deliveryDate,
                          deliveryDateOther: item.deliveryDateOther,
                          memo: item.memo,
                          orderBlocks: item.orderBlocks,
                          writtenAt: orderWrittenAt(item),
                          dueDate: item.dueDate,
                          asOf: new Date(),
                        })
                      : item.fullText || '저장된 내용이 없습니다.'}
                  </pre>
                  {(item.designImages ?? []).length > 0 && (
                    <div className={styles.imagePreview}>
                      {item.designImages.map((src, imgIndex) => (
                        <img key={imgIndex} src={src} alt={`시안 ${imgIndex + 1}`} className={styles.thumb} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function OrderQueues({
  orders,
  selectedIds,
  expandedId,
  editingId,
  saveNotice,
  printNotice,
  allSelected,
  onToggleSelected,
  onToggleExpanded,
  onProof,
  onEdit,
  onComplete,
  onDelete,
  onToggleSelectAll,
  onPrint,
  onClear,
  onMove,
}: {
  orders: OrderListItem[]
  selectedIds: string[]
  expandedId: string | null
  editingId: string | null
  saveNotice: string
  printNotice: string
  allSelected: boolean
  onToggleSelected: (id: string) => void
  onToggleExpanded: (id: string) => void
  onProof: (item: OrderListItem) => void
  onEdit: (item: OrderListItem) => void
  onComplete: (item: OrderListItem) => void
  onDelete: (id: string) => void
  onToggleSelectAll: () => void
  onPrint: () => void
  onClear: () => void
  onMove: (id: string, lane: ListLane, index: number) => void
}) {
  const dragId = useRef<string | null>(null)
  const dropRef = useRef<{ lane: ListLane; index: number } | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [drop, setDrop] = useState<{ lane: ListLane; index: number } | null>(null)
  const lanes = splitOrderLanes(orders)

  const rememberDrop = (next: { lane: ListLane; index: number } | null) => {
    dropRef.current = next
    setDrop(next)
  }

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if (event.button !== 0) return
    event.preventDefault()
    dragId.current = id
    setDraggingId(id)
    const move = (ev: PointerEvent) => {
      if (ev.clientY < 72) window.scrollBy(0, -14)
      else if (ev.clientY > window.innerHeight - 72) window.scrollBy(0, 14)
      const hit = document.elementFromPoint(ev.clientX, ev.clientY)
      const row = hit?.closest<HTMLElement>('[data-order-row]')
      const zone = hit?.closest<HTMLElement>('[data-lane]')
      if (row) {
        const rect = row.getBoundingClientRect()
        const after = ev.clientY > rect.top + rect.height / 2
        rememberDrop({
          lane: row.dataset.lane === 'final' ? 'final' : 'print',
          index: Number(row.dataset.index) + (after ? 1 : 0),
        })
      } else if (zone) {
        const count = zone.querySelectorAll('[data-order-row]').length
        rememberDrop({ lane: zone.dataset.lane === 'final' ? 'final' : 'print', index: count })
      }
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      const movingId = dragId.current
      const target = dropRef.current
      dragId.current = null
      rememberDrop(null)
      setDraggingId(null)
      if (movingId && target) onMove(movingId, target.lane, target.index)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  const laneProps = {
    selectedIds,
    expandedId,
    editingId,
    draggingId,
    onToggleSelected,
    onToggleExpanded,
    onProof,
    onEdit,
    onComplete,
    onDelete,
    onDragStart: startDrag,
  }

  return (
    <section className={styles.orderListSection}>
      {saveNotice ? <p className={styles.ledgerPwError}>{saveNotice}</p> : null}
      <OrderLane
        {...laneProps}
        lane="print"
        title="할일 목록"
        items={lanes.print}
        emptyText={orders.length === 0 ? '완료하지 않은 발주서가 없습니다.' : '할일 목록이 비어 있습니다.'}
        dropIndex={drop?.lane === 'print' ? drop.index : null}
      />
      <OrderLane
        {...laneProps}
        lane="final"
        title="최종 목록"
        items={lanes.final}
        emptyText="확인할 건을 여기로 끌어 놓으세요."
        dropIndex={drop?.lane === 'final' ? drop.index : null}
      />
      {orders.length > 0 ? (
        <>
          <div className={styles.orderListActions}>
            <button type="button" className={styles.clearAllBtn} onClick={onToggleSelectAll}>
              {allSelected ? '선택 해제' : '전체 선택'}
            </button>
            <button type="button" className={styles.pdfBtn} onClick={onPrint}>
              선택 항목 출력
            </button>
            <button type="button" className={styles.clearAllBtn} onClick={onClear}>
              전체 삭제
            </button>
          </div>
          {printNotice ? <p className={styles.ledgerPwError}>{printNotice}</p> : null}
        </>
      ) : null}
    </section>
  )
}
