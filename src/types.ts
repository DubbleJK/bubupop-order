/** 현재 화면: 메인 | 주문방식별 상세 | 발주서 정리 | 월별 가계부 */
export type Screen = 'main' | 'pop' | 'sticker' | 'dtf' | 'uv' | 'expense' | 'cardbanner' | 'tshirt' | 'summary' | 'ledger'

/** 주문방식 (메인에서 선택) */
export type OrderType = 'pop' | 'sticker' | 'dtf' | 'uv' | 'businesscard' | 'banner' | 'tshirt' | 'expense'

export interface PopItem {
  size: string
  quantity: number
  customWidth?: string
  customHeight?: string
  customProductName?: string
  memo?: string
}

export interface StickerItem {
  material: string
  width: string
  height: string
  quantity: number
  memo?: string
}

export interface DtfItem {
  size: string
  quantity: number
  memo?: string
}

export interface UvItem {
  size: string
  quantity: number
  memo?: string
}

export interface ExpenseItem {
  content: string
  amount: number
}

export interface CardBannerItem {
  size: string
  quantity: number
  memo?: string
}

export interface KidsSizeEntry {
  size: string
  quantity: number
}

export interface TshirtItem {
  designImages: string[]
  shirtType: string
  shirtTypeOther: string
  color: string
  colorOther: string
  /** 예전 사이즈 수량. 이미 저장된 발주서만 가진다. */
  sizes?: Record<string, number>
  kidsSizes?: KidsSizeEntry[]
  /** 상담 후 정리한 사이즈 */
  sizeMemo?: string
  memo?: string
}

export interface Measurements {
  frontNeckCm: string
  backNeckCm: string
  printWidthCm: string
}

export interface OrderBlock {
  orderType: OrderType
  popItems?: PopItem[]
  stickerItems?: StickerItem[]
  dtfItems?: DtfItem[]
  uvItems?: UvItem[]
  expenseItem?: ExpenseItem
  cardBannerItems?: CardBannerItem[]
  tshirtItem?: TshirtItem
}

export interface OrderListItem {
  id: string
  /** 작성일 YYYY-MM-DD. 월별 가계부 기준 */
  dateKey?: string
  ordererName: string
  orderChannel: string
  deliveryLabel: string
  deliveryDate: string
  deliveryDateOther: string
  /** 수정에서 직접 고른 납기일. 없으면 작성일과 수령 선택으로 계산한다. */
  dueDate?: string
  orderProduct: string
  fullText: string
  orderType: OrderType
  designImages: string[]
  memo: string
  orderBlocks: OrderBlock[]
  /** 견적 금액. 발주서 인쇄에는 넣지 않는다 */
  quoteAmount?: number | null
  /** 입금 완료 여부 */
  paid?: boolean
  /** 작업을 끝내 인쇄 목록에서 뺀 발주서. 가계부 기록은 남는다 */
  completed?: boolean
}
