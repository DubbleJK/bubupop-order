import { useState, useCallback, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { getDateKey, fetchOpenOrders, fetchOrdersForMonth, insertOrder, deleteOrder, updateOrder, saveOrderAmount, orderDateKey, mergeMonthOrders, pingOrders } from './lib/orderSync'
import { getLedgerSession, matchesSharedLedgerPassword } from './lib/ledgerPassword'
import { ORDER_TYPE_LABELS, buildOrdersPrintHtml, compactBlock, dateFromKey, dateKeyFromDate, deliveryView, formatOrderText, orderIsExpense, orderWrittenAt, resolveDelivery, scheduledDueDay, signedExpenseAmount, storedDueLabel, tshirtSizeNote } from './lib/orderFormat'
import { LedgerView, currentMonthKey, shiftMonth } from './LedgerView'
import { shrinkDataUrl, shrinkDesignFile } from './lib/shrinkImage'
import type { Screen, OrderType, PopItem, StickerItem, DtfItem, UvItem, CardBannerItem, TshirtItem, OrderListItem, OrderBlock } from './types'
import styles from './App.module.css'

const ORDER_CHANNEL_OPTIONS = ['개별 카톡방', '오픈채팅 카톡방', '부부피오피 플러스친구', '문자', '이메일', '기타']

const DELIVERY_DATE_OPTIONS = [
  { value: 'urgent', label: '당일/긴급', bold: true, red: true },
  { value: 'tomorrow', label: '내일' },
  { value: 'thisWeek', label: '이번주이내' },
  { value: 'nextWeek', label: '다음주까지' },
  { value: 'other', label: '기타(입력하기)', hasInput: true },
] as const

const POP_SIZES = [
  'A4 210*297',
  'A3 297*420',
  'A2 420*594',
  'A1 594*841',
  '8절 272*394',
  '4절 394*545',
  '2절 545*788',
]

const POP_CUSTOM_SIZE_VALUE = '직접 입력'
const POP_OTHER_PRODUCT_VALUE = '기타제품'

const STICKER_MATERIALS = ['모조지', '아트지', '유포지', '투명데드롱', 'pvc', '솔벤(코팅있음)', '솔벤(코팅없음)']

const TSHIRT_TYPES = ['면', '기능성', '그외']
const TSHIRT_COLORS = ['블랙', '화이트', '그외']

const initialTshirt: TshirtItem = {
  designImages: [],
  shirtType: '',
  shirtTypeOther: '',
  color: '',
  colorOther: '',
  sizeMemo: '',
}

function App() {
  const [screen, setScreen] = useState<Screen>('main')
  const [ordererName, setOrdererName] = useState('')
  const [orderChannel, setOrderChannel] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [deliveryDateOther, setDeliveryDateOther] = useState('')
  const [orderType, setOrderType] = useState<OrderType | null>(null)

  const [popItems, setPopItems] = useState<PopItem[]>([])
  const [stickerItems, setStickerItems] = useState<StickerItem[]>([])
  const [dtfItems, setDtfItems] = useState<DtfItem[]>([])
  const [uvItems, setUvItems] = useState<UvItem[]>([])
  const [expenseContent, setExpenseContent] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [cardBannerItems, setCardBannerItems] = useState<CardBannerItem[]>([])
  const [tshirtItem, setTshirtItem] = useState<TshirtItem>(initialTshirt)

  const [memo, setMemo] = useState('')
  const [orderList, setOrderList] = useState<OrderListItem[]>([])
  const [listAddMessage, setListAddMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [quoteAmountInput, setQuoteAmountInput] = useState('')
  const [paidNow, setPaidNow] = useState(false)
  const [ledgerMonth, setLedgerMonth] = useState(currentMonthKey)
  const [ledgerOrders, setLedgerOrders] = useState<OrderListItem[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [ledgerNotice, setLedgerNotice] = useState('')
  const [askLedgerPw, setAskLedgerPw] = useState(false)
  const [ledgerPwInput, setLedgerPwInput] = useState('')
  const [ledgerPwError, setLedgerPwError] = useState('')
  const [ledgerPwChecking, setLedgerPwChecking] = useState(false)
  const [syncState, setSyncState] = useState<'off' | 'checking' | 'on' | 'error'>(supabase ? 'checking' : 'off')
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [printNotice, setPrintNotice] = useState('')
  const [orderBlocks, setOrderBlocks] = useState<OrderBlock[]>([])
  const [editingPrependNextBlock, setEditingPrependNextBlock] = useState(false)
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [editingDateKey, setEditingDateKey] = useState<string | null>(null)
  const [dueDateInput, setDueDateInput] = useState('')
  const [originalDueDate, setOriginalDueDate] = useState('')
  const [dueDateTouched, setDueDateTouched] = useState(false)
  const [amountTouched, setAmountTouched] = useState(false)
  const [paidTouched, setPaidTouched] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const [saveNotice, setSaveNotice] = useState('')
  const [imageNotice, setImageNotice] = useState('')

  /** 완료하지 않은 발주서를 인쇄 목록으로 불러오고, 서버가 응답하는지도 확인 */
  useEffect(() => {
    if (!supabase) return
    let cancel = false
    fetchOpenOrders().then(({ orders, error }) => {
      if (cancel) return
      setSyncState(error ? 'error' : 'on')
      if (!error) setOrderList(orders)
    })
    const onFocus = () => {
      pingOrders().then(ok => {
        if (!cancel) setSyncState(ok ? 'on' : 'error')
      })
    }
    window.addEventListener('focus', onFocus)
    return () => {
      cancel = true
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const goToOrderDetail = useCallback((type: OrderType) => {
    setOrderType(type)
    if (type === 'uv') {
      setUvItems(prev => (prev.length ? prev : [{ size: '', quantity: 0 }]))
    }
    setScreen(type === 'businesscard' || type === 'banner' ? 'cardbanner' : type)
  }, [])

  const goMain = useCallback(() => {
    setScreen('main')
  }, [])

  const pushCurrentToOrderBlocks = useCallback(() => {
    if (!orderType) return
    const raw: OrderBlock = { orderType }
    if (orderType === 'pop') raw.popItems = [...popItems]
    if (orderType === 'sticker') raw.stickerItems = [...stickerItems]
    if (orderType === 'dtf') raw.dtfItems = [...dtfItems]
    if (orderType === 'uv') raw.uvItems = [...uvItems]
    if (orderType === 'expense') {
      raw.expenseItem = { content: expenseContent.trim(), amount: Number(expenseAmount) || 0 }
    }
    if (orderType === 'businesscard' || orderType === 'banner') raw.cardBannerItems = [...cardBannerItems]
    if (orderType === 'tshirt') raw.tshirtItem = { ...tshirtItem, designImages: [...tshirtItem.designImages] }
    const block = compactBlock(raw)
    if (!block) return
    if (editingPrependNextBlock) {
      setOrderBlocks(prev => [block, ...prev])
      setEditingPrependNextBlock(false)
    } else {
      setOrderBlocks(prev => [...prev, block])
    }
  }, [orderType, popItems, stickerItems, dtfItems, uvItems, expenseContent, expenseAmount, cardBannerItems, tshirtItem, editingPrependNextBlock])

  const clearCurrentProductAndGoMain = useCallback(() => {
    pushCurrentToOrderBlocks()
    setPopItems([])
    setStickerItems([])
    setDtfItems([])
    setUvItems([])
    setExpenseContent('')
    setExpenseAmount('')
    setCardBannerItems([])
    setTshirtItem(initialTshirt)
    goMain()
  }, [pushCurrentToOrderBlocks, goMain])

  const goSummary = useCallback(() => {
    pushCurrentToOrderBlocks()
    setScreen('summary')
  }, [pushCurrentToOrderBlocks])

  const addPopItem = useCallback(() => {
    setPopItems(prev => [...prev, { size: '', quantity: 0 }])
  }, [])
  const updatePopItem = useCallback((i: number, field: keyof PopItem, value: string | number) => {
    setPopItems(prev => prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)))
  }, [])

  const addStickerItem = useCallback(() => {
    setStickerItems(prev => [...prev, { material: '', width: '', height: '', quantity: 0 }])
  }, [])
  const updateStickerItem = useCallback((i: number, field: keyof StickerItem, value: string | number) => {
    setStickerItems(prev => prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)))
  }, [])

  const addDtfItem = useCallback(() => {
    setDtfItems(prev => [...prev, { size: '', quantity: 0 }])
  }, [])
  const updateDtfItem = useCallback((i: number, field: keyof DtfItem, value: string | number) => {
    setDtfItems(prev => prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)))
  }, [])

  const addUvItem = useCallback(() => {
    setUvItems(prev => [...prev, { size: '', quantity: 0 }])
  }, [])
  const updateUvItem = useCallback((i: number, field: keyof UvItem, value: string | number) => {
    setUvItems(prev => prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)))
  }, [])

  const addCardBannerItem = useCallback(() => {
    setCardBannerItems(prev => [...prev, { size: '', quantity: 0 }])
  }, [])
  const updateCardBannerItem = useCallback((i: number, field: keyof CardBannerItem, value: string | number) => {
    setCardBannerItems(prev => prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)))
  }, [])

  const handleTshirtDesignUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setImageNotice('')
    Array.from(files).forEach(file => {
      void shrinkDesignFile(file)
        .then(src => setTshirtItem(prev => ({ ...prev, designImages: [...prev.designImages, src] })))
        .catch(() => setImageNotice('시안 이미지를 읽지 못했습니다.'))
    })
    e.target.value = ''
  }, [])

  const clearDraft = useCallback(() => {
    setOrderBlocks([])
    setOrdererName('')
    setOrderChannel('')
    setDeliveryDate('')
    setDeliveryDateOther('')
    setOrderType(null)
    setPopItems([])
    setStickerItems([])
    setDtfItems([])
    setUvItems([])
    setExpenseContent('')
    setExpenseAmount('')
    setCardBannerItems([])
    setTshirtItem(initialTshirt)
    setMemo('')
    setQuoteAmountInput('')
    setPaidNow(false)
    setEditingOrderId(null)
    setEditingDateKey(null)
    setDueDateInput('')
    setOriginalDueDate('')
    setDueDateTouched(false)
    setAmountTouched(false)
    setPaidTouched(false)
    setEditingPrependNextBlock(false)
    setFormError('')
  }, [])

  const cancelEdit = useCallback(() => {
    clearDraft()
    setScreen('main')
  }, [clearDraft])

  const saveExpense = useCallback(async () => {
    if (savingOrder) return
    const content = expenseContent.trim()
    const amount = Number(expenseAmount)
    if (!content) {
      setFormError('지출 내용을 입력해 주세요.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('지출 금액을 입력해 주세요.')
      return
    }
    setFormError('')
    setSavingOrder(true)
    const block: OrderBlock = { orderType: 'expense', expenseItem: { content, amount } }
    const dateKey = editingDateKey || getDateKey()
    const newItem: OrderListItem = {
      id: editingOrderId || Date.now().toString(),
      ordererName: content,
      orderChannel: '',
      deliveryLabel: '',
      deliveryDate: '',
      deliveryDateOther: '',
      orderProduct: ORDER_TYPE_LABELS.expense,
      fullText: formatOrderText({
        ordererName: content,
        orderChannel: '',
        deliveryDate: '',
        deliveryDateOther: '',
        memo: '',
        orderBlocks: [block],
      }),
      orderType: 'expense',
      designImages: [],
      memo: '',
      quoteAmount: signedExpenseAmount(amount),
      paid: true,
      completed: true,
      dateKey,
      orderBlocks: [block],
    }
    const ok = editingOrderId ? await updateOrder(newItem) : await insertOrder(dateKey, newItem)
    setSavingOrder(false)
    if (!ok) {
      setFormError('서버에 저장하지 못했습니다. 다시 눌러 주세요.')
      setSyncState('error')
      return
    }
    setOrderList(prev => prev.filter(order => order.id !== newItem.id))
    setListAddMessage('지출이 가계부에 마이너스로 기록되었습니다.')
    setTimeout(() => setListAddMessage(''), 2500)
    clearDraft()
    setScreen('main')
  }, [savingOrder, expenseContent, expenseAmount, editingDateKey, editingOrderId, clearDraft])

  const generateOrder = useCallback(async () => {
    if (savingOrder) return
    const writtenAt = editingDateKey ? (dateFromKey(editingDateKey) ?? new Date()) : new Date()
    const keptDue = editingOrderId ? (dueDateTouched ? dueDateInput.trim() : originalDueDate) : ''
    const pickedDue = keptDue ? dateFromKey(keptDue) : null
    const blocks = orderBlocks.map(compactBlock).filter((b): b is OrderBlock => b !== null)
    if (blocks.length === 0) {
      setFormError('품목을 한 줄 이상 입력한 뒤 발주서를 생성해 주세요.')
      return
    }
    setFormError('')
    setSavingOrder(true)
    const prepared = await Promise.all(
      blocks.map(async block => {
        if (block.orderType !== 'tshirt' || !block.tshirtItem) return block
        const designImages = await Promise.all(block.tshirtItem.designImages.map(src => shrinkDataUrl(src)))
        return { ...block, tshirtItem: { ...block.tshirtItem, designImages } }
      })
    )
    const delivery = pickedDue
      ? { display: storedDueLabel(pickedDue) }
      : resolveDelivery(deliveryDate, deliveryDateOther, writtenAt)
    const fullText = formatOrderText({
      ordererName,
      orderChannel,
      deliveryDate,
      deliveryDateOther,
      memo,
      orderBlocks: prepared,
      writtenAt,
      dueDate: pickedDue ? dateKeyFromDate(pickedDue) : undefined,
    })
    const productLabels = prepared.map(b => ORDER_TYPE_LABELS[b.orderType]).join(', ')
    const allDesignImages = prepared
      .filter(b => b.orderType === 'tshirt')
      .flatMap(b => b.tshirtItem?.designImages ?? [])
    const dateKey = editingDateKey || getDateKey()
    const newItem: OrderListItem = {
      id: editingOrderId || Date.now().toString(),
      ordererName,
      orderChannel,
      deliveryLabel: delivery.display,
      deliveryDate,
      deliveryDateOther: deliveryDateOther || '',
      orderProduct: productLabels,
      fullText,
      orderType: prepared[0].orderType,
      designImages: allDesignImages,
      memo,
      quoteAmount: quoteAmountInput ? Number(quoteAmountInput) : null,
      paid: paidNow,
      dateKey,
      dueDate: pickedDue ? dateKeyFromDate(pickedDue) : undefined,
      orderBlocks: prepared.map(b => ({
        ...b,
        popItems: b.popItems ? [...b.popItems] : undefined,
        stickerItems: b.stickerItems ? [...b.stickerItems] : undefined,
        dtfItems: b.dtfItems ? [...b.dtfItems] : undefined,
        uvItems: b.uvItems ? [...b.uvItems] : undefined,
        expenseItem: b.expenseItem ? { ...b.expenseItem } : undefined,
        cardBannerItems: b.cardBannerItems ? [...b.cardBannerItems] : undefined,
        tshirtItem: b.tshirtItem
          ? {
              ...b.tshirtItem,
              designImages: [...b.tshirtItem.designImages],
            }
          : undefined,
      })),
    }
    if (editingOrderId && !amountTouched) delete newItem.quoteAmount
    if (editingOrderId && !paidTouched) delete newItem.paid
    let moneySaved = false
    if (editingOrderId && (amountTouched || paidTouched)) {
      const write: { quoteAmount?: number | null; paid?: boolean } = {}
      if (amountTouched) write.quoteAmount = quoteAmountInput ? Number(quoteAmountInput) : null
      if (paidTouched) write.paid = paidNow
      const moneyOk = await saveOrderAmount(newItem.id, write)
      if (!moneyOk) {
        setSavingOrder(false)
        setFormError('금액이나 입금 표시를 서버에 저장하지 못했습니다. 주문 내용은 바꾸지 않았습니다.')
        setSyncState('error')
        return
      }
      moneySaved = true
    }
    const ok = editingOrderId
      ? await updateOrder(newItem, { includeMoney: false })
      : await insertOrder(dateKey, newItem)
    setSavingOrder(false)
    if (!ok) {
      setFormError(
        moneySaved
          ? '주문 내용을 서버에 저장하지 못했습니다. 금액 표시만 반영되었을 수 있습니다. 다시 눌러 주세요.'
          : editingOrderId
            ? '서버에 저장하지 못했습니다. 인쇄 목록의 원래 발주서는 그대로입니다.'
            : '서버에 저장하지 못했습니다. 다시 눌러 주세요.'
      )
      setSyncState('error')
      return
    }
    setOrderList(prev => {
      const exists = prev.some(order => order.id === newItem.id)
      return exists ? prev.map(order => (order.id === newItem.id ? newItem : order)) : [...prev, newItem]
    })
    setSaveNotice('')
    setListAddMessage(editingOrderId ? '수정한 내용이 저장되었습니다.' : '목록에 추가되었습니다.')
    setTimeout(() => setListAddMessage(''), 2000)
    clearDraft()
    setScreen('main')
  }, [
    savingOrder,
    ordererName,
    orderChannel,
    deliveryDate,
    deliveryDateOther,
    orderBlocks,
    memo,
    quoteAmountInput,
    paidNow,
    editingOrderId,
    editingDateKey,
    dueDateInput,
    originalDueDate,
    dueDateTouched,
    amountTouched,
    paidTouched,
    clearDraft,
  ])

  const removeOrderFromList = useCallback((id: string) => {
    void deleteOrder(id).then(ok => {
      if (!ok) {
        setSaveNotice('서버에서 지우지 못했습니다. 목록에 그대로 둡니다.')
        setSyncState('error')
        return
      }
      setExpandedOrderId(prev => (prev === id ? null : prev))
      setSelectedOrderIds(prev => prev.filter(value => value !== id))
      setOrderList(prev => prev.filter(item => item.id !== id))
      if (editingOrderId === id) {
        setEditingOrderId(null)
        setEditingDateKey(null)
      }
      setSaveNotice('')
    })
  }, [editingOrderId])

  const startEditOrder = useCallback((item: OrderListItem) => {
    if (!item.orderBlocks?.length) return
    const blocks = item.orderBlocks
    const first = blocks[0]
    const rest = blocks.slice(1)

    setOrdererName(item.ordererName)
    setOrderChannel(item.orderChannel)
    setDeliveryDate(item.deliveryDate ?? '')
    setDeliveryDateOther(item.deliveryDateOther ?? '')
    const scheduled = scheduledDueDay(item)
    setDueDateInput(item.dueDate || (scheduled ? dateKeyFromDate(scheduled) : ''))
    setOriginalDueDate(item.dueDate ?? '')
    setDueDateTouched(false)
    setMemo(item.memo ?? '')
    setQuoteAmountInput(item.quoteAmount == null ? '' : String(item.quoteAmount))
    setPaidNow(!!item.paid)
    setOrderBlocks(rest)
    setEditingOrderId(item.id)
    setEditingDateKey(orderDateKey(item))
    setAmountTouched(false)
    setPaidTouched(false)
    setEditingPrependNextBlock(true)
    setSaveNotice('')
    setFormError('')
    setImageNotice('')
    setUvItems([])
    setExpenseContent('')
    setExpenseAmount('')

    switch (first.orderType) {
      case 'pop':
        setPopItems(first.popItems ?? [])
        setStickerItems([])
        setDtfItems([])
        setCardBannerItems([])
        setTshirtItem(initialTshirt)
        setOrderType('pop')
        setScreen('pop')
        break
      case 'sticker':
        setPopItems([])
        setStickerItems(first.stickerItems ?? [])
        setDtfItems([])
        setCardBannerItems([])
        setTshirtItem(initialTshirt)
        setOrderType('sticker')
        setScreen('sticker')
        break
      case 'dtf':
        setPopItems([])
        setStickerItems([])
        setDtfItems(first.dtfItems ?? [])
        setCardBannerItems([])
        setTshirtItem(initialTshirt)
        setOrderType('dtf')
        setScreen('dtf')
        break
      case 'uv':
        setPopItems([])
        setStickerItems([])
        setDtfItems([])
        setUvItems(first.uvItems?.length ? first.uvItems : [{ size: '', quantity: 0 }])
        setCardBannerItems([])
        setTshirtItem(initialTshirt)
        setOrderType('uv')
        setScreen('uv')
        break
      case 'expense':
        setPopItems([])
        setStickerItems([])
        setDtfItems([])
        setCardBannerItems([])
        setTshirtItem(initialTshirt)
        setExpenseContent(first.expenseItem?.content ?? '')
        setExpenseAmount(
          item.quoteAmount == null
            ? first.expenseItem?.amount
              ? String(Math.abs(first.expenseItem.amount))
              : ''
            : String(Math.abs(item.quoteAmount))
        )
        setOrderType('expense')
        setScreen('expense')
        break
      case 'businesscard':
      case 'banner':
        setPopItems([])
        setStickerItems([])
        setDtfItems([])
        setCardBannerItems(first.cardBannerItems ?? [])
        setTshirtItem(initialTshirt)
        setOrderType(first.orderType)
        setScreen('cardbanner')
        break
      case 'tshirt':
        setPopItems([])
        setStickerItems([])
        setDtfItems([])
        setCardBannerItems([])
        setTshirtItem(
          first.tshirtItem
            ? {
                ...first.tshirtItem,
                designImages: [...(first.tshirtItem.designImages ?? [])],
                sizes: undefined,
                kidsSizes: undefined,
                sizeMemo: tshirtSizeNote(first.tshirtItem),
              }
            : initialTshirt
        )
        setOrderType('tshirt')
        setScreen('tshirt')
        break
    }
  }, [])

  const clearOrderList = useCallback(() => {
    if (orderList.length === 0) return
    if (!window.confirm('인쇄 목록의 발주서를 모두 삭제할까요? 가계부에서도 지워집니다.')) return
    void Promise.all(orderList.map(async item => ({ id: item.id, ok: await deleteOrder(item.id) }))).then(results => {
      const failed = new Set(results.filter(result => !result.ok).map(result => result.id))
      setOrderList(prev => prev.filter(item => failed.has(item.id)))
      setSelectedOrderIds(prev => prev.filter(id => failed.has(id)))
      setSaveNotice(failed.size ? '일부 발주서를 서버에서 지우지 못했습니다. 남은 건은 목록에 그대로 둡니다.' : '')
      if (failed.size) setSyncState('error')
    })
  }, [orderList])

  const completeOrder = useCallback((item: OrderListItem) => {
    if (!window.confirm('인쇄 목록에서 뺄까요? 가계부 기록은 그대로 남습니다.')) return
    const next = { ...item, completed: true, dateKey: orderDateKey(item) }
    void updateOrder(next, { includeMoney: false }).then(ok => {
      if (!ok) {
        setSaveNotice('서버에 저장하지 못했습니다. 완료 처리가 반영되지 않았습니다.')
        setSyncState('error')
        return
      }
      setOrderList(prev => prev.filter(order => order.id !== item.id))
      setSelectedOrderIds(prev => prev.filter(id => id !== item.id))
      setLedgerOrders(prev => prev.map(order => (order.id === item.id ? next : order)))
      setSaveNotice('')
    })
  }, [])

  const toggleSelected = useCallback((id: string) => {
    setPrintNotice('')
    setSelectedOrderIds(prev => (prev.includes(id) ? prev.filter(value => value !== id) : [...prev, id]))
  }, [])

  const removeLedgerOrder = useCallback((item: OrderListItem) => {
    const name = item.ordererName || '이 발주서'
    if (!window.confirm(`${name} 건을 가계부에서 뺄까요? 반품·환불로 장부에서 지우고, 인쇄 목록에 남아 있어도 함께 사라집니다.`)) return
    void deleteOrder(item.id).then(ok => {
      if (!ok) {
        setLedgerNotice('서버에 연결되지 않아 가계부에서 빼지 못했습니다.')
        return
      }
      setLedgerOrders(prev => prev.filter(order => order.id !== item.id))
      setOrderList(prev => prev.filter(order => order.id !== item.id))
      setSelectedOrderIds(prev => prev.filter(id => id !== item.id))
      setExpandedOrderId(prev => (prev === item.id ? null : prev))
    })
  }, [])

  const saveOrderMoney = useCallback((item: OrderListItem, patch: { quoteAmount?: number | null; paid?: boolean }) => {
    const nextPatch = { ...patch }
    if (orderIsExpense(item) && typeof nextPatch.quoteAmount === 'number') {
      nextPatch.quoteAmount = signedExpenseAmount(nextPatch.quoteAmount)
    }
    const next = { ...item, ...nextPatch, dateKey: orderDateKey(item) }
    return saveOrderAmount(item.id, nextPatch).then(async saved => {
      const ok = saved || (await updateOrder(next, { includeMoney: true }))
      if (!ok) {
        setLedgerNotice('서버에 저장하지 못했습니다. 금액과 입금 표시는 이전 값으로 남습니다.')
        setSyncState('error')
        return false
      }
      setOrderList(prev => prev.map(order => (order.id === item.id ? { ...order, ...nextPatch, dateKey: next.dateKey } : order)))
      setLedgerOrders(prev => prev.map(order => (order.id === item.id ? { ...order, ...nextPatch, dateKey: next.dateKey } : order)))
      return true
    })
  }, [])

  const loadLedger = useCallback((monthKey: string) => {
    setLedgerMonth(monthKey)
    const local = orderList.filter(item => orderDateKey(item).startsWith(monthKey))
    if (!supabase) {
      setLedgerOrders(local)
      setLedgerNotice('동기화가 꺼져 있어, 이 화면에 있는 발주서만 집계됩니다.')
      setLedgerLoading(false)
      return
    }
    setLedgerLoading(true)
    setLedgerNotice('')
    fetchOrdersForMonth(monthKey, getLedgerSession()).then(({ orders, error }) => {
      setLedgerOrders(mergeMonthOrders(orders, local, monthKey))
      setLedgerNotice(error ? '서버에 연결되지 않아, 이 화면에 있는 발주서를 가계부에 표시합니다.' : '')
      setSyncState(error ? 'error' : 'on')
      setLedgerLoading(false)
    })
  }, [orderList])

  const openPrintView = useCallback(() => {
    const chosen = orderList.filter(item => selectedOrderIds.includes(item.id))
    if (chosen.length === 0) {
      setPrintNotice('출력할 발주서를 체크해 주세요.')
      return
    }
    setPrintNotice('')
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(buildOrdersPrintHtml(chosen))
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }, [orderList, selectedOrderIds])

  const visibleIds = orderList.map(item => item.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedOrderIds.includes(id))
  const toggleSelectAll = () => {
    setPrintNotice('')
    setSelectedOrderIds(allSelected ? [] : visibleIds)
  }

  const writtenLabel = (item: OrderListItem) => {
    const [, month, day] = orderDateKey(item).split('-')
    return `${Number(month)}월 ${Number(day)}일`
  }

  const keptDueKey = editingOrderId ? (dueDateTouched ? dueDateInput.trim() : originalDueDate) : ''

  const dueDateEditor = editingOrderId ? (
    <label className={styles.labelBlockSummary}>
      <span className={styles.summaryLabel}>납기일</span>
      <input
        type="date"
        className={styles.input}
        value={dueDateInput}
        onChange={e => {
          setDueDateTouched(true)
          setDueDateInput(e.target.value)
        }}
      />
      <span className={styles.hint}>작성일과 가계부 날짜는 그대로 두고, 이 발주서의 납기일만 바꿉니다.</span>
    </label>
  ) : null

  if (screen === 'ledger') {
    return (
      <LedgerView
        monthKey={ledgerMonth}
        orders={ledgerOrders}
        loading={ledgerLoading}
        synced={syncState === 'on'}
        notice={ledgerNotice}
        onBack={goMain}
        onShiftMonth={delta => loadLedger(shiftMonth(ledgerMonth, delta))}
        onSave={saveOrderMoney}
        onRemove={removeLedgerOrder}
      />
    )
  }

  if (screen === 'main') {
    return (
      <div className={styles.wrapper}>
        <h1 className={styles.title}>발주서 발행기</h1>
        <p
          className={
            syncState === 'on' ? styles.syncBadge : syncState === 'error' ? styles.syncBadgeError : styles.syncBadgeOff
          }
        >
          {syncState === 'on'
            ? 'PC·폰 동기화 연결됨'
            : syncState === 'checking'
              ? '서버 연결 확인 중'
              : syncState === 'error'
                ? '서버에 연결되지 않음'
                : '로컬만 (동기화 안 됨)'}
        </p>
        {editingOrderId ? (
          <div className={styles.editBanner}>
            <p>수정 중입니다. 발주서 생성을 눌러야 반영되고, 그 전에 나가도 원래 발주서는 남습니다.</p>
            <button type="button" className={styles.ledgerMonthBtn} onClick={cancelEdit}>
              수정 취소
            </button>
          </div>
        ) : null}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>주문자 이름</h2>
          <input
            type="text"
            className={styles.input}
            value={ordererName}
            onChange={e => setOrdererName(e.target.value)}
            placeholder="주문자 이름을 입력하세요"
          />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>주문채널</h2>
          <select
            className={styles.select}
            value={orderChannel}
            onChange={e => setOrderChannel(e.target.value)}
          >
            <option value="">선택</option>
            {ORDER_CHANNEL_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>수령일자</h2>
          <div className={styles.deliveryOptions}>
            {DELIVERY_DATE_OPTIONS.map(opt => (
              <label key={opt.value} className={styles.radioLabel}>
                <input
                  type="radio"
                  name="deliveryDate"
                  value={opt.value}
                  checked={deliveryDate === opt.value}
                  onChange={() => setDeliveryDate(opt.value)}
                />
                <span
                  className={
                    'bold' in opt && opt.bold && 'red' in opt && opt.red
                      ? styles.deliveryUrgent
                      : undefined
                  }
                >
                  {opt.label}
                </span>
              </label>
            ))}
          </div>
          {deliveryDate === 'other' && (
            <input
              type="text"
              className={styles.input}
              value={deliveryDateOther}
              onChange={e => setDeliveryDateOther(e.target.value)}
              placeholder="수령일자 직접 입력"
              style={{ marginTop: 8 }}
            />
          )}
          {dueDateEditor}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>주문 제품</h2>
          <select
            className={styles.select}
            value={orderType ?? ''}
            onChange={e => {
              const v = e.target.value as OrderType | ''
              if (v) goToOrderDetail(v)
            }}
          >
            <option value="">선택 (선택 시 해당 화면으로 이동)</option>
            {(Object.keys(ORDER_TYPE_LABELS) as OrderType[]).map(type => (
              <option key={type} value={type}>{ORDER_TYPE_LABELS[type]}</option>
            ))}
          </select>
        </section>

        {orderBlocks.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>작성 중인 발주서</h2>
            <pre className={styles.orderPreview}>{formatOrderText({
              ordererName,
              orderChannel,
              deliveryDate,
              deliveryDateOther,
              memo,
              orderBlocks,
              writtenAt: editingDateKey ? (dateFromKey(editingDateKey) ?? undefined) : undefined,
              dueDate: keptDueKey || undefined,
              asOf: editingOrderId ? new Date() : undefined,
            })}</pre>
          </section>
        )}

        <section className={styles.orderListSection}>
          <h2 className={styles.sectionTitle}>인쇄 목록</h2>
          <p className={styles.hint}>완료를 누르기 전에는 다음 날에도 남습니다. 출력은 체크한 건만 됩니다.</p>
          {saveNotice ? <p className={styles.ledgerPwError}>{saveNotice}</p> : null}
          {orderList.length === 0 ? (
            <p className={styles.orderListEmpty}>완료하지 않은 발주서가 없습니다.</p>
          ) : (
            <>
              <ul className={styles.orderList}>
                {orderList.map((item, i) => (
                  <li key={item.id} className={styles.orderListItem}>
                    <label className={styles.printCheck}>
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.includes(item.id)}
                        onChange={() => toggleSelected(item.id)}
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.orderListSummary}
                      aria-expanded={expandedOrderId === item.id}
                      onClick={() => setExpandedOrderId(prev => (prev === item.id ? null : item.id))}
                    >
                      <span className={styles.orderListDate}>{writtenLabel(item)}</span>
                      {editingOrderId === item.id ? <span className={styles.editMark}>수정 중</span> : null}
                      {i + 1}. {item.ordererName || '(주문자 없음)'} - {item.orderProduct}
                      {deliveryView(item).display ? (
                        <span className={deliveryView(item).urgent ? styles.deliveryUrgent : undefined}>
                          {' · '}{deliveryView(item).display}
                        </span>
                      ) : null}
                      <span className={styles.orderListToggle}>{expandedOrderId === item.id ? '접기' : '보기'}</span>
                    </button>
                    <span className={styles.orderListItemActions}>
                      {item.orderBlocks?.length > 0 && (
                        <button
                          type="button"
                          className={styles.orderListEditBtn}
                          onClick={() => startEditOrder(item)}
                        >
                          수정
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.orderListDoneBtn}
                        onClick={() => completeOrder(item)}
                      >
                        완료
                      </button>
                      <button
                        type="button"
                        className={styles.orderListDeleteBtn}
                        onClick={() => removeOrderFromList(item.id)}
                      >
                        삭제
                      </button>
                    </span>
                    {expandedOrderId === item.id && (
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
              <div className={styles.orderListActions}>
                <button type="button" className={styles.clearAllBtn} onClick={toggleSelectAll}>
                  {allSelected ? '선택 해제' : '전체 선택'}
                </button>
                <button type="button" className={styles.pdfBtn} onClick={openPrintView}>
                  선택 항목 출력
                </button>
                <button type="button" className={styles.clearAllBtn} onClick={clearOrderList}>
                  전체 삭제
                </button>
              </div>
              {printNotice ? <p className={styles.ledgerPwError}>{printNotice}</p> : null}
            </>
          )}
        </section>

        {askLedgerPw ? (
          <form
            className={styles.ledgerPwBox}
            onSubmit={e => {
              e.preventDefault()
              if (ledgerPwChecking) return
              setLedgerPwChecking(true)
              setLedgerPwError('')
              void matchesSharedLedgerPassword(ledgerPwInput).then(({ ok }) => {
                setLedgerPwChecking(false)
                if (!ok) {
                  setLedgerPwError('비밀번호가 맞지 않습니다.')
                  return
                }
                setAskLedgerPw(false)
                setLedgerPwInput('')
                setLedgerPwError('')
                loadLedger(currentMonthKey())
                setScreen('ledger')
              })
            }}
          >
            <input
              type="password"
              value={ledgerPwInput}
              onChange={e => setLedgerPwInput(e.target.value)}
              placeholder="비밀번호"
              autoFocus
            />
            {ledgerPwError ? <p className={styles.ledgerPwError}>{ledgerPwError}</p> : null}
            <div className={styles.ledgerPwActions}>
              <button type="submit" className={styles.ledgerMonthBtn} disabled={ledgerPwChecking}>
                {ledgerPwChecking ? '확인 중' : '확인'}
              </button>
              <button
                type="button"
                className={styles.ledgerMonthBtn}
                onClick={() => {
                  setAskLedgerPw(false)
                  setLedgerPwInput('')
                  setLedgerPwError('')
                }}
              >
                취소
              </button>
            </div>
          </form>
        ) : null}
        <button
          type="button"
          className={styles.ledgerBtn}
          onClick={() => {
            setAskLedgerPw(true)
            setLedgerPwError('')
          }}
        >
          월별 가계부
        </button>
      </div>
    )
  }

  if (screen === 'pop') {
    return (
      <div className={`${styles.wrapper} ${styles.wrapperWide} ${styles.wrapperWithFixed}`}>
        <div className={styles.fixedHeader}>
          <button type="button" className={styles.backBtn} onClick={goMain}>← 메인화면</button>
        </div>
        <div className={styles.screenHeader}>
          <h1 className={styles.screenTitle}>POP</h1>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>사이즈</th>
              <th>수량</th>
              <th>메모</th>
            </tr>
          </thead>
          <tbody>
            {popItems.map((item, i) => (
              <tr key={i}>
                <td>
                  {item.size === POP_CUSTOM_SIZE_VALUE ? (
                    <div className={styles.customSizeRow}>
                      <span className={styles.customSizeLabel}>가로</span>
                      <input
                        type="text"
                        value={item.customWidth ?? ''}
                        onChange={e => updatePopItem(i, 'customWidth', e.target.value)}
                        className={styles.customSizeInput}
                      />
                      <span>×</span>
                      <span className={styles.customSizeLabel}>세로</span>
                      <input
                        type="text"
                        value={item.customHeight ?? ''}
                        onChange={e => updatePopItem(i, 'customHeight', e.target.value)}
                        className={styles.customSizeInput}
                      />
                    </div>
                  ) : item.size === POP_OTHER_PRODUCT_VALUE ? (
                    <input
                      type="text"
                      placeholder="기타제품명 입력"
                      value={item.customProductName ?? ''}
                      onChange={e => updatePopItem(i, 'customProductName', e.target.value)}
                      className={styles.tableInputText}
                    />
                  ) : (
                    <select
                      value={item.size}
                      onChange={e => updatePopItem(i, 'size', e.target.value)}
                    >
                      <option value="">선택</option>
                      {POP_SIZES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                      <option value={POP_CUSTOM_SIZE_VALUE}>{POP_CUSTOM_SIZE_VALUE}</option>
                      <option value={POP_OTHER_PRODUCT_VALUE}>{POP_OTHER_PRODUCT_VALUE}</option>
                    </select>
                  )}
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={item.quantity || ''}
                    onChange={e => updatePopItem(i, 'quantity', Number(e.target.value) || 0)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    placeholder="주문 상세"
                    value={item.memo ?? ''}
                    onChange={e => updatePopItem(i, 'memo', e.target.value)}
                    className={styles.tableMemoInput}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className={styles.addRowBtn} onClick={addPopItem}>+ 수량 추가</button>
        <button type="button" className={styles.addItemBtn} onClick={clearCurrentProductAndGoMain}>주문품목 추가 하기</button>
        <button type="button" className={`${styles.nextBtn} ${styles.nextBtnRed}`} onClick={goSummary}>다음으로</button>
      </div>
    )
  }

  if (screen === 'sticker') {
    return (
      <div className={`${styles.wrapper} ${styles.wrapperWide} ${styles.wrapperWithFixed}`}>
        <div className={styles.fixedHeader}>
          <button type="button" className={styles.backBtn} onClick={goMain}>← 메인화면</button>
        </div>
        <div className={styles.screenHeader}>
          <h1 className={styles.screenTitle}>스티커</h1>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>재질</th>
              <th>사이즈 (가로×세로)</th>
              <th>수량</th>
              <th>메모</th>
            </tr>
          </thead>
          <tbody>
            {stickerItems.map((item, i) => (
              <tr key={i}>
                <td className={styles.stickerMaterialCell}>
                  <select
                    value={item.material}
                    onChange={e => updateStickerItem(i, 'material', e.target.value)}
                    className={styles.stickerMaterialSelect}
                  >
                    <option value="">선택</option>
                    {STICKER_MATERIALS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </td>
                <td className={styles.stickerSizeCell}>
                  <div className={styles.stickerSizeCol}>
                    <label className={styles.stickerSizeLabel}>
                      <span>가로</span>
                      <input
                        type="text"
                        value={item.width ?? ''}
                        onChange={e => updateStickerItem(i, 'width', e.target.value)}
                        className={styles.stickerSizeInput}
                      />
                    </label>
                    <label className={styles.stickerSizeLabel}>
                      <span>세로</span>
                      <input
                        type="text"
                        value={item.height ?? ''}
                        onChange={e => updateStickerItem(i, 'height', e.target.value)}
                        className={styles.stickerSizeInput}
                      />
                    </label>
                  </div>
                </td>
                <td className={styles.stickerQtyCell}>
                  <input
                    type="number"
                    min={0}
                    value={item.quantity || ''}
                    onChange={e => updateStickerItem(i, 'quantity', Number(e.target.value) || 0)}
                    className={styles.stickerQtyInput}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    placeholder="주문 상세"
                    value={item.memo ?? ''}
                    onChange={e => updateStickerItem(i, 'memo', e.target.value)}
                    className={styles.tableMemoInputSticker}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className={styles.addRowBtn} onClick={addStickerItem}>+ 수량 추가</button>
        <button type="button" className={styles.addItemBtn} onClick={clearCurrentProductAndGoMain}>주문품목 추가 하기</button>
        <button type="button" className={`${styles.nextBtn} ${styles.nextBtnRed}`} onClick={goSummary}>다음으로</button>
      </div>
    )
  }

  if (screen === 'dtf') {
    return (
      <div className={`${styles.wrapper} ${styles.wrapperWide} ${styles.wrapperWithFixed}`}>
        <div className={styles.fixedHeader}>
          <button type="button" className={styles.backBtn} onClick={goMain}>← 메인화면</button>
        </div>
        <div className={styles.screenHeader}>
          <h1 className={styles.screenTitle}>DTF</h1>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>사이즈</th>
              <th>수량</th>
              <th>메모</th>
            </tr>
          </thead>
          <tbody>
            {dtfItems.map((item, i) => (
              <tr key={i}>
                <td>
                  <input
                    type="text"
                    value={item.size}
                    onChange={e => updateDtfItem(i, 'size', e.target.value)}
                    placeholder="사이즈"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={item.quantity || ''}
                    onChange={e => updateDtfItem(i, 'quantity', Number(e.target.value) || 0)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    placeholder="주문 상세"
                    value={item.memo ?? ''}
                    onChange={e => updateDtfItem(i, 'memo', e.target.value)}
                    className={styles.tableMemoInput}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className={styles.addRowBtn} onClick={addDtfItem}>+ 수량 추가</button>
        <button type="button" className={styles.addItemBtn} onClick={clearCurrentProductAndGoMain}>주문품목 추가 하기</button>
        <button type="button" className={`${styles.nextBtn} ${styles.nextBtnRed}`} onClick={goSummary}>다음으로</button>
      </div>
    )
  }

  if (screen === 'uv') {
    return (
      <div className={`${styles.wrapper} ${styles.wrapperWide} ${styles.wrapperWithFixed}`}>
        <div className={styles.fixedHeader}>
          <button type="button" className={styles.backBtn} onClick={goMain}>← 메인화면</button>
        </div>
        <div className={styles.screenHeader}>
          <h1 className={styles.screenTitle}>UV출력물</h1>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>사이즈</th>
              <th>수량</th>
              <th>메모</th>
            </tr>
          </thead>
          <tbody>
            {uvItems.map((item, i) => (
              <tr key={i}>
                <td>
                  <input
                    type="text"
                    value={item.size}
                    onChange={e => updateUvItem(i, 'size', e.target.value)}
                    placeholder="사이즈"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={item.quantity || ''}
                    onChange={e => updateUvItem(i, 'quantity', Number(e.target.value) || 0)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    placeholder="주문 상세"
                    value={item.memo ?? ''}
                    onChange={e => updateUvItem(i, 'memo', e.target.value)}
                    className={styles.tableMemoInput}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className={styles.addRowBtn} onClick={addUvItem}>+ 수량 추가</button>
        <button type="button" className={styles.addItemBtn} onClick={clearCurrentProductAndGoMain}>주문품목 추가 하기</button>
        <button type="button" className={`${styles.nextBtn} ${styles.nextBtnRed}`} onClick={goSummary}>다음으로</button>
      </div>
    )
  }

  if (screen === 'expense') {
    return (
      <div className={`${styles.wrapper} ${styles.wrapperWide} ${styles.wrapperWithFixed}`}>
        <div className={styles.fixedHeader}>
          <button type="button" className={styles.backBtn} onClick={goMain}>← 메인화면</button>
        </div>
        <div className={styles.screenHeader}>
          <h1 className={styles.screenTitle}>지출</h1>
        </div>
        <p className={styles.hint}>인쇄 목록에는 들어가지 않습니다. 월별 가계부에 마이너스 금액으로 남습니다.</p>
        {formError ? <p className={styles.ledgerPwError}>{formError}</p> : null}
        <label className={styles.labelBlockSummary}>
          <span className={styles.summaryLabel}>내용</span>
          <textarea
            value={expenseContent}
            onChange={e => setExpenseContent(e.target.value)}
            placeholder="어디에 썼는지 적어 주세요."
            rows={4}
          />
        </label>
        <label className={styles.labelBlockSummary}>
          <span className={styles.summaryLabel}>금액</span>
          <input
            type="text"
            inputMode="numeric"
            className={styles.input}
            value={expenseAmount ? Number(expenseAmount).toLocaleString('ko-KR') : ''}
            onChange={e => setExpenseAmount(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="숫자만 입력"
          />
        </label>
        <button type="button" className={`${styles.nextBtn} ${styles.nextBtnRed}`} onClick={() => void saveExpense()} disabled={savingOrder}>
          {savingOrder ? '저장 중' : '가계부에 기록'}
        </button>
      </div>
    )
  }

  if (screen === 'cardbanner') {
    return (
      <div className={`${styles.wrapper} ${styles.wrapperWide} ${styles.wrapperWithFixed}`}>
        <div className={styles.fixedHeader}>
          <button type="button" className={styles.backBtn} onClick={goMain}>← 메인화면</button>
        </div>
        <div className={styles.screenHeader}>
          <h1 className={styles.screenTitle}>{orderType ? ORDER_TYPE_LABELS[orderType] : '명함·배너'}</h1>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>사이즈</th>
              <th>수량</th>
              <th>메모</th>
            </tr>
          </thead>
          <tbody>
            {cardBannerItems.map((item, i) => (
              <tr key={i}>
                <td>
                  <input
                    type="text"
                    value={item.size}
                    onChange={e => updateCardBannerItem(i, 'size', e.target.value)}
                    placeholder="사이즈"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={item.quantity || ''}
                    onChange={e => updateCardBannerItem(i, 'quantity', Number(e.target.value) || 0)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    placeholder="주문 상세"
                    value={item.memo ?? ''}
                    onChange={e => updateCardBannerItem(i, 'memo', e.target.value)}
                    className={styles.tableMemoInput}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className={styles.addRowBtn} onClick={addCardBannerItem}>+ 수량 추가</button>
        <button type="button" className={styles.addItemBtn} onClick={clearCurrentProductAndGoMain}>주문품목 추가 하기</button>
        <button type="button" className={`${styles.nextBtn} ${styles.nextBtnRed}`} onClick={goSummary}>다음으로</button>
      </div>
    )
  }

  if (screen === 'tshirt') {
    return (
      <div className={`${styles.wrapper} ${styles.wrapperWide} ${styles.wrapperWithFixed}`}>
        <div className={styles.fixedHeader}>
          <button type="button" className={styles.backBtn} onClick={goMain}>← 메인화면</button>
        </div>
        <div className={styles.screenHeader}>
          <h1 className={styles.screenTitle}>티셔츠</h1>
        </div>

        <div className={styles.tshirtSection}>
          <span className={styles.sizeLabel}>디자인 등록</span>
          <input type="file" accept="image/*" multiple onChange={handleTshirtDesignUpload} className={styles.fileInput} />
          {imageNotice ? <p className={styles.ledgerPwError}>{imageNotice}</p> : null}
          {tshirtItem.designImages.length > 0 && (
            <div className={styles.imagePreview}>
              {tshirtItem.designImages.map((src, i) => (
                <img key={i} src={src} alt={`디자인 ${i + 1}`} className={styles.thumb} />
              ))}
            </div>
          )}
        </div>

        <div className={styles.tshirtSection}>
          <span className={styles.sizeLabel}>티셔츠 종류</span>
          <select
            className={styles.select}
            value={tshirtItem.shirtType}
            onChange={e => setTshirtItem(prev => ({ ...prev, shirtType: e.target.value }))}
          >
            <option value="">선택</option>
            {TSHIRT_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {tshirtItem.shirtType === '그외' && (
            <input
              type="text"
              placeholder="직접 입력"
              value={tshirtItem.shirtTypeOther}
              onChange={e => setTshirtItem(prev => ({ ...prev, shirtTypeOther: e.target.value }))}
              className={styles.tshirtOtherInput}
            />
          )}
        </div>

        <div className={styles.tshirtSection}>
          <span className={styles.sizeLabel}>티셔츠 색상</span>
          <select
            className={styles.select}
            value={tshirtItem.color}
            onChange={e => setTshirtItem(prev => ({ ...prev, color: e.target.value }))}
          >
            <option value="">선택</option>
            {TSHIRT_COLORS.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {tshirtItem.color === '그외' && (
            <input
              type="text"
              placeholder="직접 입력"
              value={tshirtItem.colorOther}
              onChange={e => setTshirtItem(prev => ({ ...prev, colorOther: e.target.value }))}
              className={styles.tshirtOtherInput}
            />
          )}
        </div>

        <label className={styles.tshirtSizeMemo}>
          <span>사이즈</span>
          <textarea
            placeholder="상담 후 사이즈와 수량을 정리해서 적으세요."
            value={tshirtItem.sizeMemo ?? ''}
            onChange={e => setTshirtItem(prev => ({ ...prev, sizeMemo: e.target.value }))}
            rows={5}
          />
        </label>

        <label className={styles.tshirtMemoLabel}>
          <span>메모</span>
          <input
            type="text"
            placeholder="주문 상세 내용"
            value={tshirtItem.memo ?? ''}
            onChange={e => setTshirtItem(prev => ({ ...prev, memo: e.target.value }))}
            className={styles.tshirtMemoInput}
          />
        </label>
        <button type="button" className={styles.addItemBtn} onClick={clearCurrentProductAndGoMain}>주문품목 추가 하기</button>
        <button type="button" className={`${styles.nextBtn} ${styles.nextBtnRed}`} onClick={goSummary}>다음으로</button>
      </div>
    )
  }

  const hasBlocksOrType = orderBlocks.length > 0 || orderType !== null
  const hasTshirt = orderType === 'tshirt' || orderBlocks.some(b => b.orderType === 'tshirt')
  // 품목이 없을 때(발주서 생성 직후 등)에도 정리 화면 유지 → summary A 표시
  const isSummaryA = screen === 'summary' && (!hasBlocksOrType || !hasTshirt)
  const isSummaryB = screen === 'summary' && hasBlocksOrType && hasTshirt

  if (screen === 'summary' && isSummaryA) {
    return (
      <div className={`${styles.wrapper} ${styles.wrapperWide} ${styles.wrapperWithFixed}`}>
        <div className={styles.fixedHeader}>
          <button type="button" className={styles.backBtn} onClick={() => setScreen(orderType === 'businesscard' || orderType === 'banner' ? 'cardbanner' : (orderType ?? 'main'))}>
            ← 이전
          </button>
        </div>

        {dueDateEditor}

        <label className={styles.labelBlockSummary}>
          <span className={styles.summaryLabel}>추가 지시 사항</span>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="추가 지시 사항을 입력하세요."
            rows={4}
          />
        </label>

        <div className={styles.labelBlockSummary}>
          <span className={styles.summaryLabel}>견적 금액</span>
          <input
            type="text"
            inputMode="numeric"
            className={styles.input}
            value={quoteAmountInput ? Number(quoteAmountInput).toLocaleString('ko-KR') : ''}
            onChange={e => {
              setAmountTouched(true)
              setQuoteAmountInput(e.target.value.replace(/[^\d]/g, ''))
            }}
            placeholder="숫자만 입력"
          />
          <span className={styles.hint}>발주서 인쇄에는 금액이 나오지 않습니다.</span>
          {editingOrderId ? (
            <span className={styles.hint}>금액이나 입금을 바꾸지 않으면 가계부에 있는 값이 유지됩니다.</span>
          ) : null}
          <label className={styles.radioLabel}>
            <input type="checkbox" checked={paidNow} onChange={e => { setPaidTouched(true); setPaidNow(e.target.checked) }} />
            <span>입금 완료</span>
          </label>
        </div>

        <pre className={styles.orderPreview}>{formatOrderText({
          ordererName,
          orderChannel,
          deliveryDate,
          deliveryDateOther,
          memo,
          orderBlocks,
          writtenAt: editingDateKey ? (dateFromKey(editingDateKey) ?? undefined) : undefined,
          dueDate: keptDueKey || undefined,
          asOf: editingOrderId ? new Date() : undefined,
        })}</pre>
        {formError ? <p className={styles.generateError}>{formError}</p> : null}

        <div className={styles.summaryBtnRow}>
          <button type="button" className={`${styles.generateBtn} ${styles.generateBtnRed}`} onClick={() => void generateOrder()} disabled={savingOrder}>
            {savingOrder ? '저장 중' : editingOrderId ? '수정 내용 저장' : '발주서 생성'}
          </button>
        </div>
        {listAddMessage ? <p className={styles.listAddMessage}>{listAddMessage}</p> : null}

        <section className={styles.orderListSection}>
          <h2 className={styles.sectionTitle}>인쇄 목록</h2>
          <p className={styles.hint}>완료를 누르기 전에는 다음 날에도 남습니다. 출력은 체크한 건만 됩니다.</p>
          {saveNotice ? <p className={styles.ledgerPwError}>{saveNotice}</p> : null}
          {orderList.length === 0 ? (
            <p className={styles.orderListEmpty}>완료하지 않은 발주서가 없습니다.</p>
          ) : (
            <>
              <ul className={styles.orderList}>
                {orderList.map((item, i) => (
                  <li key={item.id} className={styles.orderListItem}>
                    <label className={styles.printCheck}>
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.includes(item.id)}
                        onChange={() => toggleSelected(item.id)}
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.orderListSummary}
                      aria-expanded={expandedOrderId === item.id}
                      onClick={() => setExpandedOrderId(prev => (prev === item.id ? null : item.id))}
                    >
                      <span className={styles.orderListDate}>{writtenLabel(item)}</span>
                      {editingOrderId === item.id ? <span className={styles.editMark}>수정 중</span> : null}
                      {i + 1}. {item.ordererName || '(주문자 없음)'} - {item.orderProduct}
                      {deliveryView(item).display ? (
                        <span className={deliveryView(item).urgent ? styles.deliveryUrgent : undefined}>
                          {' · '}{deliveryView(item).display}
                        </span>
                      ) : null}
                      <span className={styles.orderListToggle}>{expandedOrderId === item.id ? '접기' : '보기'}</span>
                    </button>
                    <span className={styles.orderListItemActions}>
                      {item.orderBlocks?.length > 0 && (
                        <button
                          type="button"
                          className={styles.orderListEditBtn}
                          onClick={() => startEditOrder(item)}
                        >
                          수정
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.orderListDoneBtn}
                        onClick={() => completeOrder(item)}
                      >
                        완료
                      </button>
                      <button
                        type="button"
                        className={styles.orderListDeleteBtn}
                        onClick={() => removeOrderFromList(item.id)}
                      >
                        삭제
                      </button>
                    </span>
                    {expandedOrderId === item.id && (
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
              <div className={styles.orderListActions}>
                <button type="button" className={styles.clearAllBtn} onClick={toggleSelectAll}>
                  {allSelected ? '선택 해제' : '전체 선택'}
                </button>
                <button type="button" className={styles.pdfBtn} onClick={openPrintView}>
                  선택 항목 출력
                </button>
                <button type="button" className={styles.clearAllBtn} onClick={clearOrderList}>
                  전체 삭제
                </button>
              </div>
              {printNotice ? <p className={styles.ledgerPwError}>{printNotice}</p> : null}
            </>
          )}
        </section>
      </div>
    )
  }

  if (screen === 'summary' && isSummaryB) {
    return (
      <div className={`${styles.wrapper} ${styles.wrapperWide} ${styles.wrapperWithFixed}`}>
        <div className={styles.fixedHeader}>
          <button type="button" className={styles.backBtn} onClick={() => setScreen('tshirt')}>
            ← 이전
          </button>
        </div>

        {dueDateEditor}

        <label className={styles.labelBlockSummary}>
          <span className={styles.summaryLabel}>추가 지시 사항</span>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="추가 지시 사항을 입력하세요."
            rows={4}
          />
        </label>

        <div className={styles.labelBlockSummary}>
          <span className={styles.summaryLabel}>견적 금액</span>
          <input
            type="text"
            inputMode="numeric"
            className={styles.input}
            value={quoteAmountInput ? Number(quoteAmountInput).toLocaleString('ko-KR') : ''}
            onChange={e => {
              setAmountTouched(true)
              setQuoteAmountInput(e.target.value.replace(/[^\d]/g, ''))
            }}
            placeholder="숫자만 입력"
          />
          <span className={styles.hint}>발주서 인쇄에는 금액이 나오지 않습니다.</span>
          {editingOrderId ? (
            <span className={styles.hint}>금액이나 입금을 바꾸지 않으면 가계부에 있는 값이 유지됩니다.</span>
          ) : null}
          <label className={styles.radioLabel}>
            <input type="checkbox" checked={paidNow} onChange={e => { setPaidTouched(true); setPaidNow(e.target.checked) }} />
            <span>입금 완료</span>
          </label>
        </div>

        <pre className={styles.orderPreview}>{formatOrderText({
          ordererName,
          orderChannel,
          deliveryDate,
          deliveryDateOther,
          memo,
          orderBlocks,
          writtenAt: editingDateKey ? (dateFromKey(editingDateKey) ?? undefined) : undefined,
          dueDate: keptDueKey || undefined,
          asOf: editingOrderId ? new Date() : undefined,
        })}</pre>
        {formError ? <p className={styles.generateError}>{formError}</p> : null}

        <div className={styles.summaryBtnRow}>
          <button type="button" className={`${styles.generateBtn} ${styles.generateBtnRed}`} onClick={() => void generateOrder()} disabled={savingOrder}>
            {savingOrder ? '저장 중' : editingOrderId ? '수정 내용 저장' : '발주서 생성'}
          </button>
        </div>
        {listAddMessage ? <p className={styles.listAddMessage}>{listAddMessage}</p> : null}

        <section className={styles.orderListSection}>
          <h2 className={styles.sectionTitle}>인쇄 목록</h2>
          <p className={styles.hint}>완료를 누르기 전에는 다음 날에도 남습니다. 출력은 체크한 건만 됩니다.</p>
          {saveNotice ? <p className={styles.ledgerPwError}>{saveNotice}</p> : null}
          {orderList.length === 0 ? (
            <p className={styles.orderListEmpty}>완료하지 않은 발주서가 없습니다.</p>
          ) : (
            <>
              <ul className={styles.orderList}>
                {orderList.map((item, i) => (
                  <li key={item.id} className={styles.orderListItem}>
                    <label className={styles.printCheck}>
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.includes(item.id)}
                        onChange={() => toggleSelected(item.id)}
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.orderListSummary}
                      aria-expanded={expandedOrderId === item.id}
                      onClick={() => setExpandedOrderId(prev => (prev === item.id ? null : item.id))}
                    >
                      <span className={styles.orderListDate}>{writtenLabel(item)}</span>
                      {editingOrderId === item.id ? <span className={styles.editMark}>수정 중</span> : null}
                      {i + 1}. {item.ordererName || '(주문자 없음)'} - {item.orderProduct}
                      {deliveryView(item).display ? (
                        <span className={deliveryView(item).urgent ? styles.deliveryUrgent : undefined}>
                          {' · '}{deliveryView(item).display}
                        </span>
                      ) : null}
                      <span className={styles.orderListToggle}>{expandedOrderId === item.id ? '접기' : '보기'}</span>
                    </button>
                    <span className={styles.orderListItemActions}>
                      {item.orderBlocks?.length > 0 && (
                        <button
                          type="button"
                          className={styles.orderListEditBtn}
                          onClick={() => startEditOrder(item)}
                        >
                          수정
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.orderListDoneBtn}
                        onClick={() => completeOrder(item)}
                      >
                        완료
                      </button>
                      <button
                        type="button"
                        className={styles.orderListDeleteBtn}
                        onClick={() => removeOrderFromList(item.id)}
                      >
                        삭제
                      </button>
                    </span>
                    {expandedOrderId === item.id && (
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
              <div className={styles.orderListActions}>
                <button type="button" className={styles.clearAllBtn} onClick={toggleSelectAll}>
                  {allSelected ? '선택 해제' : '전체 선택'}
                </button>
                <button type="button" className={styles.pdfBtn} onClick={openPrintView}>
                  선택 항목 출력
                </button>
                <button type="button" className={styles.clearAllBtn} onClick={clearOrderList}>
                  전체 삭제
                </button>
              </div>
              {printNotice ? <p className={styles.ledgerPwError}>{printNotice}</p> : null}
            </>
          )}
        </section>
      </div>
    )
  }

  if (screen === 'summary' && !isSummaryA && !isSummaryB) {
    return (
      <div className={`${styles.wrapper} ${styles.wrapperWide} ${styles.wrapperWithFixed}`}>
        <div className={styles.fixedHeader}>
          <button type="button" className={styles.backBtn} onClick={goMain}>← 메인화면</button>
        </div>
        <p className={styles.instruction}>주문 제품을 선택한 후 발주서로 정리하기를 이용해 주세요.</p>
      </div>
    )
  }

  return null
}

export default App
