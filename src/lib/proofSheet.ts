import {
  deliveryView,
  formatKoreanDate,
  ORDER_TYPE_LABELS,
  scheduledDueDay,
  tshirtSizeNote,
} from './orderFormat'
import type {
  CardBannerItem,
  DtfItem,
  OrderBlock,
  OrderListItem,
  PopItem,
  StickerItem,
  TshirtItem,
  UvItem,
} from '../types'

const POP_CUSTOM = '직접 입력'
const POP_OTHER = '기타제품'
const SHEET_WIDTH = 1080
const SIDE = 28
const PAD = 10
const GAP = 8
const FONT = '"Malgun Gothic", sans-serif'
const TITLE = '시안확인용 이미지 입니다.'
export const DEFAULT_CUT_NOTE = '빨간선은 재단선입니다'
const NOTICE_TITLE = '시안 확인 안내'
const NOTICE_BODY = [
  '디자인, 문구, 제작 크기 및 수량을 확인해 주세요.',
  '시안 확정 후 제작이 시작되면 수정이 어려울 수 있습니다.',
  '※ 세부 디자인 확인이 필요한 경우 별도 확대 이미지를 제공해 드립니다.',
]

export type ProofColumns = 1 | 2

export interface ProofFact {
  label: string
  value: string
  red?: boolean
}

function withUnit(size: string): string {
  const text = size.trim()
  if (!text) return ''
  if (/mm|cm/i.test(text)) return text
  return `${text} mm`
}

function popSize(item: PopItem): string {
  if (item.size === POP_CUSTOM) {
    return `${item.customWidth?.trim() || '-'} × ${item.customHeight?.trim() || '-'}`
  }
  if (item.size === POP_OTHER) return item.customProductName?.trim() || '기타제품'
  return (item.size || '').replace(/\*/g, '×')
}

function pairSize(width: string, height: string): string {
  const w = width.trim()
  const h = height.trim()
  if (!w && !h) return ''
  return withUnit(`${w || '-'} × ${h || '-'}`)
}

function pushRow(rows: ProofFact[], label: string, value: string) {
  const text = value.trim()
  if (text) rows.push({ label, value: text })
}

function rowsFromSimple(category: string, item: { size: string; quantity: number; memo?: string }) {
  const rows: ProofFact[] = []
  pushRow(rows, '품목', category)
  pushRow(rows, '사이즈', item.size?.trim() || '')
  pushRow(rows, '수량', item.quantity > 0 ? String(item.quantity) : '')
  pushRow(rows, '메모', item.memo || '')
  return rows
}

function rowsFromSticker(item: StickerItem): ProofFact[] {
  const rows: ProofFact[] = []
  const material = item.material?.trim()
  pushRow(rows, '품목', material ? `스티커 · ${material}` : '스티커')
  pushRow(rows, '사이즈', pairSize(item.width, item.height))
  pushRow(rows, '수량', item.quantity > 0 ? String(item.quantity) : '')
  pushRow(rows, '메모', item.memo || '')
  return rows
}

function rowsFromPop(item: PopItem): ProofFact[] {
  const rows: ProofFact[] = []
  const size = popSize(item)
  pushRow(rows, '품목', item.size === POP_OTHER && size ? `POP · ${size}` : 'POP')
  if (item.size !== POP_OTHER) pushRow(rows, '사이즈', size)
  pushRow(rows, '수량', item.quantity > 0 ? String(item.quantity) : '')
  pushRow(rows, '메모', item.memo || '')
  return rows
}

function rowsFromTshirt(item: TshirtItem): ProofFact[] {
  const type = item.shirtType === '그외' ? item.shirtTypeOther?.trim() || '그외' : item.shirtType?.trim()
  const color = item.color === '그외' ? item.colorOther?.trim() || '그외' : item.color?.trim()
  const rows: ProofFact[] = []
  pushRow(rows, '품목', '티셔츠')
  pushRow(rows, '종류', type || '')
  pushRow(rows, '색상', color || '')
  pushRow(rows, '사이즈', tshirtSizeNote(item))
  pushRow(rows, '메모', item.memo || '')
  return rows
}

function rowsFromBlock(block: OrderBlock): ProofFact[][] {
  if (block.orderType === 'pop') return (block.popItems ?? []).map(rowsFromPop)
  if (block.orderType === 'sticker') return (block.stickerItems ?? []).map(rowsFromSticker)
  if (block.orderType === 'dtf') return (block.dtfItems ?? []).map(item => rowsFromSimple('DTF', item as DtfItem))
  if (block.orderType === 'uv') return (block.uvItems ?? []).map(item => rowsFromSimple(ORDER_TYPE_LABELS.uv, item as UvItem))
  if (block.orderType === 'businesscard' || block.orderType === 'banner') {
    const category = ORDER_TYPE_LABELS[block.orderType]
    return (block.cardBannerItems ?? []).map(item => rowsFromSimple(category, item as CardBannerItem))
  }
  if (block.orderType === 'tshirt' && block.tshirtItem) return [rowsFromTshirt(block.tshirtItem)]
  return []
}

export function proofDueText(item: OrderListItem): string {
  const due = scheduledDueDay(item)
  if (due) return formatKoreanDate(due).replace(/^\d{4}년\s*/, '')
  return deliveryView(item).display
}

export function proofFacts(item: OrderListItem): ProofFact[] {
  const facts: ProofFact[] = []
  const groups = (item.orderBlocks ?? []).flatMap(rowsFromBlock).filter(group => group.length > 0)
  if (groups.length === 0 && item.orderProduct?.trim()) {
    facts.push({ label: '품목', value: item.orderProduct.trim() })
  } else {
    groups.forEach(group => facts.push(...group))
  }
  if (item.memo?.trim()) pushRow(facts, '추가 지시', item.memo)
  return facts
}

export function proofFactsText(item: OrderListItem): string {
  return proofFacts(item)
    .map(fact => {
      const [first, ...rest] = fact.value.split(/\r?\n/)
      return [`${fact.label}: ${first ?? ''}`, ...rest].join('\n')
    })
    .join('\n')
}

export function factsFromText(text: string): ProofFact[] {
  const facts: ProofFact[] = []
  text.split(/\r?\n/).forEach(raw => {
    const line = raw.replace(/\s+$/, '')
    const match = line.match(/^([^:\n]{1,10}):\s?(.*)$/)
    if (match && match[1].trim()) {
      facts.push({ label: match[1].trim(), value: match[2] })
      return
    }
    if (!line && facts.length === 0) return
    if (facts.length === 0) {
      facts.push({ label: '', value: line })
      return
    }
    const current = facts[facts.length - 1]
    current.value = current.value ? `${current.value}\n${line}` : line
  })
  return facts.filter(fact => fact.label || fact.value.trim())
}

export interface ProofOptions {
  columns?: ProofColumns
  showCutNote?: boolean
  cutNote?: string
  showDue?: boolean
  dueText?: string
  showFacts?: boolean
  factsText?: string
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image'))
    img.src = src
  })
}

let logoTask: Promise<HTMLImageElement | null> | null = null

function loadLogo(): Promise<HTMLImageElement | null> {
  if (!logoTask) {
    logoTask = loadImage('/bubupop-wordmark.png').catch(() => null)
  }
  return logoTask
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const ch of text) {
    const next = line + ch
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line)
      line = ch
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

function placeCaptures(captures: HTMLImageElement[], columns: ProofColumns, innerW: number) {
  const usable = innerW - PAD * 2
  const cols = columns === 2 && captures.length > 1 ? 2 : 1
  const cellW = cols === 1 ? usable : Math.floor((usable - GAP) / 2)
  const placed: { img: HTMLImageElement; x: number; y: number; w: number; h: number }[] = []
  let cursor = PAD
  for (let index = 0; index < captures.length; index += cols) {
    const row = captures.slice(index, index + cols)
    const sized = row.map(img => {
      const sourceW = img.naturalWidth || img.width || 1
      const sourceH = img.naturalHeight || img.height || 1
      return { img, w: cellW, h: Math.max(1, Math.round((sourceH / sourceW) * cellW)) }
    })
    const rowH = Math.max(...sized.map(size => size.h))
    sized.forEach((size, col) => {
      placed.push({
        img: size.img,
        x: PAD + col * (cellW + GAP),
        y: cursor,
        w: size.w,
        h: size.h,
      })
    })
    const lastRow = index + cols >= captures.length
    cursor += rowH + (lastRow ? 0 : GAP)
  }
  return { placed, panelH: Math.max(cursor + PAD, PAD * 2) }
}

/** 붙여넣은 캡처와 발주 내용으로 고객 확인용 시안을 그린다. */
export async function renderProofSheet(
  item: OrderListItem,
  captures: HTMLImageElement[],
  options: ProofOptions = {}
): Promise<Blob> {
  if (captures.length === 0) throw new Error('capture')
  const columns = options.columns ?? 1
  const logo = await loadLogo()
  const facts = options.showFacts === false
    ? []
    : factsFromText(options.factsText ?? proofFactsText(item))
  const dueText = options.showDue ? (options.dueText ?? '').trim() : ''
  if (dueText) facts.push({ label: '납기', value: dueText, red: true })
  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) throw new Error('canvas')

  const textWidth = SHEET_WIDTH - SIDE * 2
  const cutText = options.showCutNote ? (options.cutNote ?? '').trim() : ''
  measure.font = `600 20px ${FONT}`
  const cutLines = cutText ? wrapText(measure, cutText, textWidth) : []
  measure.font = `400 18px ${FONT}`
  const noticeLines = NOTICE_BODY.map(line => wrapText(measure, line, textWidth))
  const valueMax = textWidth - 108
  measure.font = `600 20px ${FONT}`
  const factLineGroups = facts.map(fact => {
    const max = fact.label ? valueMax : textWidth
    return fact.value.split(/\r?\n/).flatMap(line => {
      const text = line.trimEnd()
      return text ? wrapText(measure, text, max) : ['']
    })
  })
  const lineStep = 28
  const factHeights = factLineGroups.map(lines => lines.length * lineStep + 4)
  const { placed, panelH } = placeCaptures(captures, columns, textWidth)
  const logoH = logo ? 52 : 0
  const titleH = 40
  const noteH = cutLines.length * 28
  const noticeH = 30 + noticeLines.reduce((sum, lines) => sum + lines.length * 26 + 4, 0)
  const height =
    24 +
    logoH +
    8 +
    titleH +
    noteH +
    12 +
    panelH +
    16 +
    factHeights.reduce((sum, row) => sum + row, 0) +
    14 +
    noticeH +
    18

  const canvas = document.createElement('canvas')
  canvas.width = SHEET_WIDTH
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, SHEET_WIDTH, height)
  ctx.textBaseline = 'middle'
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  let y = 20
  if (logo) {
    const logoW = Math.round(logoH * (logo.width / logo.height))
    ctx.drawImage(logo, (SHEET_WIDTH - logoW) / 2, y, logoW, logoH)
    y += logoH + 8
  }

  ctx.fillStyle = '#1c1917'
  ctx.font = `700 30px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText(TITLE, SHEET_WIDTH / 2, y + 16)
  y += titleH

  if (cutLines.length > 0) {
    ctx.fillStyle = '#d10000'
    ctx.font = `600 20px ${FONT}`
    cutLines.forEach(line => {
      ctx.fillText(line, SHEET_WIDTH / 2, y + 12)
      y += 28
    })
  }

  y += 8
  ctx.fillStyle = '#f4f1ec'
  roundRect(ctx, SIDE, y, textWidth, panelH, 8)
  ctx.fill()
  placed.forEach(place => {
    ctx.drawImage(place.img, SIDE + place.x, y + place.y, place.w, place.h)
  })
  y += panelH + 16

  ctx.textAlign = 'left'
  const labelWidth = 92
  facts.forEach((fact, index) => {
    const lines = factLineGroups[index]
    lines.forEach((line, lineIndex) => {
      if (lineIndex === 0 && fact.label) {
        ctx.font = `500 18px ${FONT}`
        ctx.fillStyle = '#a8a29e'
        ctx.fillText(fact.label, SIDE, y + 12)
      }
      ctx.font = `600 20px ${FONT}`
      ctx.fillStyle = fact.red ? '#d10000' : '#44403c'
      ctx.fillText(line, fact.label ? SIDE + labelWidth : SIDE, y + 12)
      y += lineStep
    })
    y += 4
  })

  y += 10
  ctx.textAlign = 'center'
  ctx.fillStyle = '#292524'
  ctx.font = `600 20px ${FONT}`
  ctx.fillText(NOTICE_TITLE, SHEET_WIDTH / 2, y + 12)
  y += 30
  ctx.fillStyle = '#57534e'
  ctx.font = `400 18px ${FONT}`
  noticeLines.forEach(lines => {
    lines.forEach(line => {
      ctx.fillText(line, SHEET_WIDTH / 2, y + 10)
      y += 26
    })
    y += 4
  })

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('blob')
  return blob
}

export async function copyImageBlob(blob: Blob): Promise<boolean> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}
