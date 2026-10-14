import { useEffect, useState } from 'react'
import { formatLedgerDetail, orderWrittenAt } from './lib/orderFormat'
import { matchesSharedLedgerPassword, writeSharedLedgerPassword } from './lib/ledgerPassword'
import { orderDateKey } from './lib/orderSync'
import { isSupabaseEnabled } from './lib/supabase'
import type { OrderListItem } from './types'
import styles from './App.module.css'

export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

export function currentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number)
  const d = new Date(year, month - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  return `${year}년 ${Number(month)}월`
}

function dayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  return `${month}월 ${day}일 (${weekdays[date.getDay()]})`
}

function detailOf(item: OrderListItem) {
  return formatLedgerDetail({
    ordererName: item.ordererName,
    orderChannel: item.orderChannel,
    deliveryDate: item.deliveryDate,
    deliveryDateOther: item.deliveryDateOther,
    memo: item.memo ?? '',
    orderBlocks: item.orderBlocks ?? [],
    fullText: item.fullText,
    writtenAt: orderWrittenAt(item),
  })
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function downloadLedgerExcel(monthKey: string, orders: OrderListItem[]) {
  const header = ['날짜', '주문자', '주문채널', '수령', '품목', '주문내역', '비고', '견적금액', '입금여부']
  const sorted = [...orders].sort(
    (a, b) => orderDateKey(a).localeCompare(orderDateKey(b)) || a.id.localeCompare(b.id)
  )
  const body = sorted.map(item => {
    const detail = detailOf(item)
    return [
      orderDateKey(item),
      item.ordererName || '',
      item.orderChannel || '',
      item.deliveryLabel || '',
      item.orderProduct || '',
      detail.details,
      detail.note,
      item.quoteAmount ?? '',
      item.paid ? '입금' : '미입금',
    ]
  })
  const rows = [header, ...body]
    .map(row => {
      const cells = row
        .map(value => {
          if (typeof value === 'number') return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`
          return `<Cell><Data ss:Type="String">${xmlEscape(String(value))}</Data></Cell>`
        })
        .join('')
      return `<Row>${cells}</Row>`
    })
    .join('')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="가계부"><Table>${rows}</Table></Worksheet>
</Workbook>`
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `가계부_${monthKey}.xls`
  link.click()
  URL.revokeObjectURL(url)
}

function PasswordChange() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setMessage('')
    setError('')
    if (!next.trim()) {
      setError('새 비밀번호를 입력해 주세요.')
      return
    }
    if (next !== again) {
      setError('새 비밀번호가 서로 다릅니다.')
      return
    }
    setSaving(true)
    const { ok: currentOk } = await matchesSharedLedgerPassword(current)
    if (!currentOk) {
      setSaving(false)
      setError('현재 비밀번호가 맞지 않습니다.')
      return
    }
    const ok = await writeSharedLedgerPassword(current, next)
    setSaving(false)
    if (!ok) {
      setError('서버에 연결되지 않아 비밀번호를 바꾸지 못했습니다.')
      return
    }
    setCurrent('')
    setNext('')
    setAgain('')
    setMessage(
      isSupabaseEnabled()
        ? '비밀번호를 바꿨습니다. PC와 폰이 같은 비밀번호를 씁니다.'
        : '이 기기의 비밀번호를 바꿨습니다.'
    )
  }

  return (
    <div className={styles.ledgerPwChange}>
      <button type="button" className={styles.ledgerMonthBtn} onClick={() => setOpen(prev => !prev)}>
        비밀번호 변경
      </button>
      {open ? (
        <div className={styles.ledgerPwBox}>
          <p className={styles.moneyNote}>여기서 바꾸면 PC와 폰이 같은 비밀번호를 씁니다. 처음 비밀번호는 1000입니다.</p>
          <input type="password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="현재 비밀번호" />
          <input type="password" value={next} onChange={e => setNext(e.target.value)} placeholder="새 비밀번호" />
          <input type="password" value={again} onChange={e => setAgain(e.target.value)} placeholder="새 비밀번호 확인" />
          {error ? <p className={styles.ledgerPwError}>{error}</p> : null}
          {message ? <p className={styles.moneyNote}>{message}</p> : null}
          <button type="button" className={styles.ledgerMonthBtn} onClick={() => void save()} disabled={saving}>
            {saving ? '저장 중' : '저장'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

interface MoneyPatch {
  quoteAmount?: number | null
  paid?: boolean
}

export function OrderMoneyFields({
  item,
  onSave,
  showNote = true,
}: {
  item: OrderListItem
  onSave: (patch: MoneyPatch) => void | boolean | Promise<boolean | void>
  showNote?: boolean
}) {
  const [text, setText] = useState(item.quoteAmount == null ? '' : String(item.quoteAmount))

  useEffect(() => {
    setText(item.quoteAmount == null ? '' : String(item.quoteAmount))
  }, [item.id, item.quoteAmount])

  return (
    <div className={styles.moneyBox}>
      <label className={styles.moneyAmount}>
        <span>견적 금액</span>
        <input
          type="text"
          inputMode="numeric"
          value={text ? Number(text).toLocaleString('ko-KR') : ''}
          onChange={e => setText(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={() => {
            const next = text ? Number(text) : null
            if (next === (item.quoteAmount ?? null)) return
            void Promise.resolve(onSave({ quoteAmount: next })).then(ok => {
              if (ok === false) setText(item.quoteAmount == null ? '' : String(item.quoteAmount))
            })
          }}
          placeholder="금액"
        />
      </label>
      <label className={styles.moneyPaid}>
        <input
          type="checkbox"
          checked={!!item.paid}
          onChange={e => onSave({ paid: e.target.checked })}
        />
        <span>{item.paid ? '입금 완료' : '미입금'}</span>
      </label>
      {showNote ? <p className={styles.moneyNote}>발주서 인쇄에는 금액이 나오지 않습니다.</p> : null}
    </div>
  )
}

export function LedgerView({
  monthKey,
  orders,
  loading,
  synced,
  notice,
  onBack,
  onShiftMonth,
  onSave,
  onRemove,
}: {
  monthKey: string
  orders: OrderListItem[]
  loading: boolean
  synced: boolean
  notice: string
  onBack: () => void
  onShiftMonth: (delta: number) => void
  onSave: (item: OrderListItem, patch: MoneyPatch) => void
  onRemove: (item: OrderListItem) => void
}) {
  const quoted = orders.filter(item => typeof item.quoteAmount === 'number')
  const total = quoted.reduce((sum, item) => sum + (item.quoteAmount ?? 0), 0)
  const paidTotal = quoted.filter(item => item.paid).reduce((sum, item) => sum + (item.quoteAmount ?? 0), 0)
  const unpaidTotal = total - paidTotal
  const missingCount = orders.length - quoted.length

  const groups = new Map<string, OrderListItem[]>()
  orders.forEach(item => {
    const key = orderDateKey(item)
    const list = groups.get(key) ?? []
    list.push(item)
    groups.set(key, list)
  })
  const days = Array.from(groups.keys()).sort()

  return (
    <div className={`${styles.wrapper} ${styles.wrapperLedger}`}>
      <div className={styles.ledgerTop}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          ← 메인화면
        </button>
        <h1 className={styles.title}>월별 가계부</h1>
      </div>
      <p className={styles.moneyNote}>견적과 입금만 모아 둔 장부입니다. 발주서 인쇄에는 금액이 나오지 않습니다.</p>
      {notice ? <p className={styles.syncBadgeOff}>{notice}</p> : null}
      {!synced && !notice ? (
        <p className={styles.syncBadgeOff}>동기화가 꺼져 있어, 이 화면에 남아 있는 발주서만 집계됩니다.</p>
      ) : null}

      <div className={styles.ledgerMonthRow}>
        <button type="button" className={styles.ledgerMonthBtn} onClick={() => onShiftMonth(-1)}>
          이전 달
        </button>
        <strong>{monthLabel(monthKey)}</strong>
        <button type="button" className={styles.ledgerMonthBtn} onClick={() => onShiftMonth(1)}>
          다음 달
        </button>
      </div>

      <div className={styles.ledgerTotals}>
        <div>
          <span>견적 합계</span>
          <strong>{formatWon(total)}</strong>
        </div>
        <div>
          <span>입금</span>
          <strong className={styles.paidMark}>{formatWon(paidTotal)}</strong>
        </div>
        <div>
          <span>미입금</span>
          <strong className={styles.unpaidMark}>{formatWon(unpaidTotal)}</strong>
        </div>
      </div>
      {missingCount > 0 ? (
        <p className={styles.hint}>금액이 비어 있는 발주서 {missingCount}건은 합계에서 빠집니다.</p>
      ) : null}

      {loading ? <p className={styles.orderListEmpty}>불러오는 중입니다.</p> : null}
      {!loading && orders.length === 0 ? (
        <p className={styles.orderListEmpty}>이 달에는 저장된 발주서가 없습니다.</p>
      ) : null}

      {!loading && orders.length > 0 ? (
        <div className={styles.ledgerExcelRow}>
          <button type="button" className={styles.ledgerExcelBtn} onClick={() => downloadLedgerExcel(monthKey, orders)}>
            엑셀로 저장
          </button>
        </div>
      ) : null}

      {days.map(day => (
        <section key={day} className={styles.ledgerDay}>
          <h2>{dayLabel(day)}</h2>
          <ul className={styles.ledgerList}>
            {(groups.get(day) ?? []).map(item => {
              const detail = detailOf(item)
              return (
                <li key={item.id}>
                  <div className={styles.ledgerWho}>
                    <strong>{item.ordererName || '(주문자 없음)'}</strong>
                    <span>{item.orderProduct || '품목 없음'} · {item.completed ? '처리 완료' : '인쇄 대기'}</span>
                  </div>
                  <pre className={styles.ledgerDetail}>{detail.details}</pre>
                  {detail.note ? <p className={styles.ledgerNote}>비고 {detail.note}</p> : null}
                  <OrderMoneyFields item={item} showNote={false} onSave={patch => onSave(item, patch)} />
                  <button type="button" className={styles.ledgerRemoveBtn} onClick={() => onRemove(item)}>
                    장부에서 빼기
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <PasswordChange />
    </div>
  )
}
