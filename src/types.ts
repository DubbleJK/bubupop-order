/** 현재 화면: 메인 | 주문방식별 상세 | 발주서 정리 */
export type Screen = 'main' | 'pop' | 'sticker' | 'dtf' | 'cardbanner' | 'tshirt' | 'summary'

/** 주문방식 (메인에서 선택) */
export type OrderType = 'pop' | 'sticker' | 'dtf' | 'businesscard' | 'banner' | 'tshirt'

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
  sizes: Record<string, number>
  kidsSizes: KidsSizeEntry[]
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
  cardBannerItems?: CardBannerItem[]
  tshirtItem?: TshirtItem
}

export interface OrderListItem {
  id: string
  ordererName: string
  orderChannel: string
  deliveryLabel: string
  deliveryDate: string
  deliveryDateOther: string
  orderProduct: string
  fullText: string
  orderType: OrderType
  designImages: string[]
  memo: string
  orderBlocks: OrderBlock[]
}
