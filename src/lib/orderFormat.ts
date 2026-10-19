import type {
  CardBannerItem,
  DtfItem,
  ExpenseItem,
  OrderBlock,
  OrderListItem,
  OrderType,
  PopItem,
  StickerItem,
  TshirtItem,
  UvItem,
} from '../types'

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  pop: 'POP',
  sticker: '스티커',
  dtf: 'DTF',
  uv: 'UV출력물',
  businesscard: '명함',
  banner: '배너',
  tshirt: '티셔츠',
  expense: '지출',
}

export function orderIsExpense(item: { orderType?: string; orderBlocks?: { orderType: string }[] }): boolean {
  return item.orderType === 'expense' || (item.orderBlocks ?? []).some(block => block.orderType === 'expense')
}

/** 지출은 가계부에 마이너스로 남긴다. 입력은 양수로 받고, 0은 그대로 둔다. */
export function signedExpenseAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount === 0) return 0
  return -Math.abs(Math.round(amount))
}

const POP_CUSTOM_SIZE_VALUE = '직접 입력'
const POP_OTHER_PRODUCT_VALUE = '기타제품'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export interface OrderHeaderInput {
  ordererName: string
  orderChannel: string
  deliveryDate: string
  deliveryDateOther: string
  memo: string
  orderBlocks: OrderBlock[]
  writtenAt?: Date
}

export interface ResolvedDelivery {
  shortLabel: string
  display: string
  urgent: boolean
}

interface SpecRow {
  category: string
  lines: string[]
  quantity: string
  memo: string
}

interface CompiledOrder {
  writtenAt: Date
  ordererName: string
  orderChannel: string
  delivery: ResolvedDelivery
  rows: SpecRow[]
  penFill: boolean
  imageCount: number
  memo: string
}

export function formatKoreanDate(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, days: number): Date {
  const next = startOfDay(d)
  next.setDate(next.getDate() + days)
  return next
}

/** 이번 주 일요일, 또는 extraWeeks만큼 뒤의 일요일 */
function sundayOfWeek(base: Date, extraWeeks: number): Date {
  const d = startOfDay(base)
  const day = d.getDay()
  const toSunday = day === 0 ? 0 : 7 - day
  d.setDate(d.getDate() + toSunday + extraWeeks * 7)
  return d
}

export function resolveDelivery(
  deliveryDate: string,
  deliveryDateOther: string,
  writtenAt: Date
): ResolvedDelivery {
  if (deliveryDate === 'urgent') {
    const date = formatKoreanDate(writtenAt)
    return { shortLabel: '당일/긴급', display: `당일/긴급 · ${date}`, urgent: true }
  }
  if (deliveryDate === 'tomorrow') {
    const date = formatKoreanDate(addDays(writtenAt, 1))
    return { shortLabel: '내일', display: `내일 · ${date}`, urgent: false }
  }
  if (deliveryDate === 'thisWeek') {
    const date = formatKoreanDate(sundayOfWeek(writtenAt, 0))
    return { shortLabel: '이번주이내', display: `이번주이내 · ${date}까지`, urgent: false }
  }
  if (deliveryDate === 'nextWeek') {
    const date = formatKoreanDate(sundayOfWeek(writtenAt, 1))
    return { shortLabel: '다음주까지', display: `다음주까지 · ${date}`, urgent: false }
  }
  if (deliveryDate === 'other') {
    const text = deliveryDateOther.trim()
    return { shortLabel: text || '기타', display: text || '기타', urgent: false }
  }
  return { shortLabel: '', display: '', urgent: false }
}

function qtyText(n: number | undefined): string {
  return n && n > 0 ? String(n) : '미입력'
}

function popDetail(item: PopItem): string {
  if (item.size === POP_CUSTOM_SIZE_VALUE) {
    const w = item.customWidth?.trim() || '-'
    const h = item.customHeight?.trim() || '-'
    return `직접입력 ${w}×${h}`
  }
  if (item.size === POP_OTHER_PRODUCT_VALUE) {
    return item.customProductName?.trim() ? `기타제품 ${item.customProductName.trim()}` : '기타제품'
  }
  if (!item.size?.trim()) return '사이즈 미입력'
  return item.size.replace(/\*/g, '×')
}

function stickerDetail(item: StickerItem): string {
  const mat = item.material?.trim() || '재질 미입력'
  const w = item.width?.trim() || ''
  const h = item.height?.trim() || ''
  if (w && h) return `${mat} ${w}×${h}`
  if (w || h) return `${mat} ${w || '-'}×${h || '-'}`
  return mat
}

function simpleSize(size: string | undefined): string {
  return size?.trim() || '사이즈 미입력'
}

function rowFilled(detail: string, quantity: number, memo?: string): boolean {
  const hasDetail = detail !== '사이즈 미입력' && detail !== '재질 미입력' && detail !== '기타제품'
  return hasDetail || quantity > 0 || !!memo?.trim()
}

function legacyTshirtSizeText(ti: TshirtItem): string {
  const sizeParts = Object.entries(ti.sizes ?? {})
    .filter(([, qty]) => qty > 0)
    .map(([size, qty]) => `${size} ${qty}`)
  const extraParts = (ti.kidsSizes ?? [])
    .filter(entry => entry.size?.trim() || entry.quantity > 0)
    .map(entry => `${entry.size?.trim() || '사이즈미입력'} ${entry.quantity || 0}`)
  const parts = [...sizeParts]
  if (extraParts.length) parts.push(`그외 ${extraParts.join(', ')}`)
  return parts.join(', ')
}

/** 새 메모가 있으면 그 글이고, 없으면 예전 사이즈 수량을 한 줄로 되돌린다. */
export function tshirtSizeNote(ti: TshirtItem): string {
  return ti.sizeMemo?.trim() || legacyTshirtSizeText(ti)
}

function tshirtLines(ti: TshirtItem): { lines: string[]; total: number } {
  const typeLabel = ti.shirtType === '그외' ? ti.shirtTypeOther?.trim() || '그외' : ti.shirtType?.trim() || '미입력'
  const colorLabel = ti.color === '그외' ? ti.colorOther?.trim() || '그외' : ti.color?.trim() || '미입력'
  const wroteSize = !!ti.sizeMemo?.trim()
  const sizeText = tshirtSizeNote(ti)
  const lines = [`종류 ${typeLabel}`, `색상 ${colorLabel}`]
  lines.push(sizeText ? `사이즈 ${sizeText}` : '사이즈 미입력')
  const total = wroteSize
    ? 0
    : Object.values(ti.sizes ?? {}).reduce((sum, qty) => sum + (qty > 0 ? qty : 0), 0) +
      (ti.kidsSizes ?? []).reduce((sum, entry) => sum + (entry.quantity > 0 ? entry.quantity : 0), 0)
  return { lines, total }
}

function expenseHasContent(item: ExpenseItem | undefined): boolean {
  if (!item) return false
  return !!item.content.trim() || item.amount > 0
}

function tshirtHasContent(ti: TshirtItem | undefined): boolean {
  if (!ti) return false
  const { total } = tshirtLines(ti)
  return (
    total > 0 ||
    !!ti.sizeMemo?.trim() ||
    !!ti.shirtType ||
    !!ti.color ||
    !!ti.memo?.trim() ||
    (ti.designImages?.length ?? 0) > 0 ||
    (ti.kidsSizes ?? []).some(k => !!k.size?.trim())
  )
}

/** 빈 줄은 빼고, 내용이 전혀 없으면 null */
export function compactBlock(block: OrderBlock): OrderBlock | null {
  if (block.orderType === 'pop') {
    const popItems = (block.popItems ?? []).filter(item =>
      rowFilled(popDetail(item), item.quantity, item.memo)
    )
    return popItems.length ? { ...block, popItems } : null
  }
  if (block.orderType === 'sticker') {
    const stickerItems = (block.stickerItems ?? []).filter(item =>
      rowFilled(stickerDetail(item), item.quantity, item.memo)
    )
    return stickerItems.length ? { ...block, stickerItems } : null
  }
  if (block.orderType === 'dtf') {
    const dtfItems = (block.dtfItems ?? []).filter(item =>
      rowFilled(simpleSize(item.size), item.quantity, item.memo)
    )
    return dtfItems.length ? { ...block, dtfItems } : null
  }
  if (block.orderType === 'uv') {
    const uvItems = (block.uvItems ?? []).filter(item =>
      rowFilled(simpleSize(item.size), item.quantity, item.memo)
    )
    return uvItems.length ? { ...block, uvItems } : null
  }
  if (block.orderType === 'expense' && block.expenseItem && expenseHasContent(block.expenseItem)) {
    return { ...block, expenseItem: { content: block.expenseItem.content.trim(), amount: block.expenseItem.amount } }
  }
  if (block.orderType === 'businesscard' || block.orderType === 'banner') {
    const cardBannerItems = (block.cardBannerItems ?? []).filter(item =>
      rowFilled(simpleSize(item.size), item.quantity, item.memo)
    )
    return cardBannerItems.length ? { ...block, cardBannerItems } : null
  }
  if (block.orderType === 'tshirt' && tshirtHasContent(block.tshirtItem)) {
    return block
  }
  return null
}

function rowsFromBlock(block: OrderBlock): SpecRow[] {
  if (block.orderType === 'pop') {
    return (block.popItems ?? []).map(item => ({
      category: 'POP',
      lines: [popDetail(item)],
      quantity: qtyText(item.quantity),
      memo: item.memo?.trim() || '',
    }))
  }
  if (block.orderType === 'sticker') {
    return (block.stickerItems ?? []).map(item => ({
      category: '스티커',
      lines: [stickerDetail(item)],
      quantity: qtyText(item.quantity),
      memo: item.memo?.trim() || '',
    }))
  }
  if (block.orderType === 'dtf') {
    return (block.dtfItems ?? []).map(item => ({
      category: 'DTF',
      lines: [simpleSize(item.size)],
      quantity: qtyText(item.quantity),
      memo: item.memo?.trim() || '',
    }))
  }
  if (block.orderType === 'uv') {
    return (block.uvItems ?? []).map((item: UvItem) => ({
      category: ORDER_TYPE_LABELS.uv,
      lines: [simpleSize(item.size)],
      quantity: qtyText(item.quantity),
      memo: item.memo?.trim() || '',
    }))
  }
  if (block.orderType === 'expense' && block.expenseItem) {
    return [
      {
        category: ORDER_TYPE_LABELS.expense,
        lines: [block.expenseItem.content.trim() || '내용 없음'],
        quantity: '',
        memo: '',
      },
    ]
  }
  if (block.orderType === 'businesscard' || block.orderType === 'banner') {
    const category = ORDER_TYPE_LABELS[block.orderType]
    return (block.cardBannerItems ?? []).map((item: CardBannerItem | DtfItem) => ({
      category,
      lines: [simpleSize(item.size)],
      quantity: qtyText(item.quantity),
      memo: item.memo?.trim() || '',
    }))
  }
  if (block.orderType === 'tshirt' && block.tshirtItem) {
    const { lines, total } = tshirtLines(block.tshirtItem)
    return [
      {
        category: '티셔츠',
        lines,
        quantity: block.tshirtItem.sizeMemo?.trim() ? '' : total > 0 ? String(total) : '미입력',
        memo: block.tshirtItem.memo?.trim() || '',
      },
    ]
  }
  return []
}

function compileOrder(input: OrderHeaderInput): CompiledOrder {
  const writtenAt = input.writtenAt ?? new Date()
  const blocks = input.orderBlocks.map(compactBlock).filter((b): b is OrderBlock => b !== null)
  const rows = blocks.flatMap(rowsFromBlock)
  const penFill = blocks.some(b => b.orderType === 'tshirt')
  const imageCount = blocks
    .filter(b => b.orderType === 'tshirt')
    .reduce((sum, b) => sum + (b.tshirtItem?.designImages?.length ?? 0), 0)
  return {
    writtenAt,
    ordererName: input.ordererName.trim(),
    orderChannel: input.orderChannel.trim(),
    delivery: resolveDelivery(input.deliveryDate, input.deliveryDateOther, writtenAt),
    rows,
    penFill,
    imageCount,
    memo: input.memo.trim(),
  }
}

export function formatOrderText(input: OrderHeaderInput): string {
  const order = compileOrder(input)
  const lines: string[] = []
  lines.push('부부피오피 발주서')
  lines.push(`작성  ${formatKoreanDate(order.writtenAt)}`)
  lines.push('')
  lines.push(`주문자    ${order.ordererName || '미입력'}`)
  lines.push(`주문채널  ${order.orderChannel || '미입력'}`)
  lines.push(`수령      ${order.delivery.display || '미입력'}`)
  lines.push('')
  if (order.rows.length === 0) {
    lines.push('품목 없음')
  } else {
    order.rows.forEach((row, i) => {
      lines.push(`${i + 1}. [${row.category}] ${row.lines.join(' / ')}`)
      if (row.quantity || row.memo) {
        lines.push(`    ${row.quantity ? `수량 ${row.quantity}` : ''}${row.memo ? `${row.quantity ? '  ·  ' : ''}메모 ${row.memo}` : ''}`)
      }
    })
  }
  if (order.imageCount > 0) {
    lines.push('')
    lines.push(`시안 이미지 ${order.imageCount}장 (출력 하단에 첨부)`)
  }
  if (order.memo) {
    lines.push('')
    lines.push('[추가 지시]')
    lines.push(order.memo)
  }
  if (order.penFill) {
    lines.push('')
    lines.push('[티셔츠 출력 후 기입]')
    lines.push('  앞  목 봉제선 아래 __________ cm')
    lines.push('  뒤  목 봉제선 아래 __________ cm')
    lines.push('  인쇄 가로 __________ cm')
  }
  return lines.join('\n')
}

/** 가계부용 주문 내용과 비고. 금액은 포함하지 않는다. */
export function formatLedgerDetail(input: OrderHeaderInput & { fullText?: string }): { details: string; note: string } {
  if (!input.orderBlocks.length) {
    return { details: input.fullText?.trim() || '품목 없음', note: input.memo.trim() }
  }
  const order = compileOrder(input)
  const details = order.rows.length
    ? order.rows
        .map((row, i) => {
          const memo = row.memo ? ` / 메모 ${row.memo}` : ''
          const qty = row.quantity ? ` / 수량 ${row.quantity}` : ''
          return `${i + 1}. ${row.category} ${row.lines.join(' / ')}${qty}${memo}`
        })
        .join('\n')
    : '품목 없음'
  return { details, note: order.memo }
}

export function orderWrittenAt(item: { id: string }): Date {
  const n = Number(item.id)
  if (Number.isFinite(n) && n > 1_000_000_000_000) return new Date(n)
  return new Date()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 인쇄 HTML에 넣을 수 있는 시안. base64 이미지 데이터만 허용한다. */
const SAFE_IMAGE_SRC = /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/]+={0,2}$/i

function isSafeImageSrc(src: string): boolean {
  return SAFE_IMAGE_SRC.test(src)
}

function collectImages(item: OrderListItem): string[] {
  const fromBlocks = (item.orderBlocks ?? [])
    .filter(b => b.orderType === 'tshirt')
    .flatMap(b => b.tshirtItem?.designImages ?? [])
    .filter(isSafeImageSrc)
  if (fromBlocks.length > 0) return fromBlocks
  return (item.designImages ?? []).filter(isSafeImageSrc)
}

function sheetHtml(item: OrderListItem, index: number, total: number): string {
  const writtenAt = orderWrittenAt(item)
  const blocks = (item.orderBlocks ?? []).map(compactBlock).filter((b): b is OrderBlock => b !== null)
  const order = compileOrder({
    ordererName: item.ordererName,
    orderChannel: item.orderChannel,
    deliveryDate: item.deliveryDate,
    deliveryDateOther: item.deliveryDateOther,
    memo: item.memo,
    orderBlocks: blocks,
    writtenAt,
  })
  const images = collectImages(item)
  const parts: string[] = []
  parts.push('<article class="sheet">')
  parts.push('<header class="head">')
  parts.push('<h1>발주서</h1>')
  parts.push(
    `<p class="sub">부부피오피 · ${escapeHtml(formatKoreanDate(writtenAt))} 작성 · ${index}/${total}</p>`
  )
  parts.push('</header>')
  parts.push('<table class="info">')
  parts.push(
    `<tr><th>주문자</th><td>${escapeHtml(order.ordererName || '미입력')}</td><th>주문채널</th><td>${escapeHtml(order.orderChannel || '미입력')}</td></tr>`
  )
  const deliveryClass = order.delivery.urgent ? ' class="urgent"' : ''
  const deliveryText = order.delivery.display || item.deliveryLabel || '미입력'
  parts.push(`<tr><th>수령</th><td colspan="3"${deliveryClass}>${escapeHtml(deliveryText)}</td></tr>`)
  parts.push('</table>')

  if (blocks.length === 0 && item.fullText?.trim()) {
    parts.push(`<pre class="legacy">${escapeHtml(item.fullText)}</pre>`)
  } else if (order.rows.length === 0) {
    parts.push('<p class="empty">품목 없음</p>')
  } else {
    parts.push('<table class="items"><thead><tr><th>번호</th><th>품목</th><th>내용</th><th>수량</th><th>메모</th></tr></thead><tbody>')
    order.rows.forEach((row, i) => {
      const detail = row.lines.map(line => escapeHtml(line)).join('<br>')
      parts.push(
        `<tr><td class="num">${i + 1}</td><td>${escapeHtml(row.category)}</td><td>${detail}</td><td class="num">${escapeHtml(row.quantity)}</td><td>${escapeHtml(row.memo || '')}</td></tr>`
      )
    })
    parts.push('</tbody></table>')
  }

  if (order.memo) {
    parts.push('<section class="note"><h2>추가 지시</h2>')
    parts.push(`<p>${escapeHtml(order.memo).replace(/\n/g, '<br>')}</p></section>`)
  }
  if (order.penFill) {
    parts.push('<section class="pen"><h2>티셔츠 출력 후 기입</h2><ul>')
    parts.push('<li>앞 &nbsp; 목 봉제선 아래 __________ cm</li>')
    parts.push('<li>뒤 &nbsp; 목 봉제선 아래 __________ cm</li>')
    parts.push('<li>인쇄 가로 __________ cm</li>')
    parts.push('</ul></section>')
  }
  if (images.length > 0) {
    parts.push('<section class="images"><h2>시안</h2>')
    images.forEach(src => {
      parts.push(`<img src="${escapeHtml(src)}" alt="시안" />`)
    })
    parts.push('</section>')
  }
  parts.push('</article>')
  return parts.join('')
}

export function buildOrdersPrintHtml(items: OrderListItem[]): string {
  const now = new Date()
  const title = `${now.getMonth() + 1}월 ${now.getDate()}일 발주서`
  const css = [
    '@page{size:A4;margin:8mm;}',
    'body{font-family:Malgun Gothic,dotum,sans-serif;font-size:11px;color:#111;margin:0;}',
    '.slip{break-inside:avoid;page-break-inside:avoid;margin:0 0 2px;}',
    '.sheet{border:1px solid #222;padding:8px 8px 10px;margin:0;}',
    '.cut{margin:7px 0 6px;border-top:1px dashed #666;text-align:center;color:#666;font-size:10px;line-height:0;letter-spacing:0.2em;}',
    '.cut span{background:#fff;padding:0 8px;}',
    '.head h1{margin:0;text-align:center;font-size:16px;letter-spacing:0.28em;}',
    '.sub{margin:2px 0 6px;text-align:center;font-size:11px;}',
    'table{width:100%;border-collapse:collapse;margin-top:4px;}',
    'th,td{border:1px solid #333;padding:3px 5px;vertical-align:top;text-align:left;}',
    '.info th{width:64px;background:#f2f2f2;font-weight:700;}',
    '.items th{background:#222;color:#fff;font-weight:600;}',
    '.num{text-align:center;white-space:nowrap;width:44px;}',
    '.urgent{color:#c00;font-weight:800;font-size:13px;}',
    '.note,.pen,.images{margin-top:8px;}',
    '.note h2,.pen h2,.images h2{margin:0 0 4px;font-size:12px;}',
    '.note p,.pen li{margin:0;line-height:1.45;}',
    '.pen{border:1px dashed #555;padding:6px 8px;}',
    '.pen ul{margin:0;padding-left:16px;}',
    '.images img{max-width:140px;max-height:100px;margin:4px 6px 0 0;border:1px solid #ccc;}',
    '.legacy{white-space:pre-wrap;font-family:inherit;font-size:11px;}',
    '.empty{margin:8px 0 0;}',
  ].join('')
  const body = items
    .map((item, i) => {
      const cut = i === 0 ? '' : '<div class="cut"><span>절취선</span></div>'
      return `<section class="slip">${cut}${sheetHtml(item, i + 1, items.length)}</section>`
    })
    .join('')
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${css}</style></head><body>${body}</body></html>`
}
