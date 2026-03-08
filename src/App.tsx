import { useState, useCallback } from 'react'
import type { Screen, OrderType, PopItem, StickerItem, DtfItem, CardBannerItem, TshirtItem, OrderListItem, OrderBlock, Measurements } from './types'
import styles from './App.module.css'

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  pop: 'POP',
  sticker: '스티커',
  dtf: 'DTF',
  businesscard: '명함',
  banner: '배너',
  tshirt: '티셔츠',
}

const ORDER_CHANNEL_OPTIONS = ['개별카카오톡방', '부부피오피카톡방', '플러스친구', '문자', '이메일', '기타']

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

const TSHIRT_SIZES = ['S(90)', 'M(95)', 'L(100)', 'XL(105)', '3XL(110)', '4XL(115)', '5XL(120)']

const TSHIRT_TYPES = ['면', '기능성', '그외']
const TSHIRT_COLORS = ['블랙', '화이트', '그외']

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const initialMeasurements: Measurements = {
  frontNeckCm: '',
  backNeckCm: '',
  printWidthCm: '',
}

const initialTshirt: TshirtItem = {
  designImages: [],
  shirtType: '',
  shirtTypeOther: '',
  color: '',
  colorOther: '',
  sizes: Object.fromEntries(TSHIRT_SIZES.map(s => [s, 0])),
  kidsSizes: [],
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
  const [cardBannerItems, setCardBannerItems] = useState<CardBannerItem[]>([])
  const [tshirtItem, setTshirtItem] = useState<TshirtItem>(initialTshirt)
  const [kidsSizeInput, setKidsSizeInput] = useState('')
  const [kidsSizeQtyInput, setKidsSizeQtyInput] = useState<number>(0)

  const [measurements, _setMeasurements] = useState<Measurements>(initialMeasurements)
  const [memo, setMemo] = useState('')
  const [orderList, setOrderList] = useState<OrderListItem[]>([])
  const [listAddMessage, setListAddMessage] = useState(false)
  const [orderBlocks, setOrderBlocks] = useState<OrderBlock[]>([])
  const [editingPrependNextBlock, setEditingPrependNextBlock] = useState(false)

  const goToOrderDetail = useCallback((type: OrderType) => {
    setOrderType(type)
    setScreen(type === 'businesscard' || type === 'banner' ? 'cardbanner' : type)
  }, [])

  const goMain = useCallback(() => {
    setScreen('main')
  }, [])

  const pushCurrentToOrderBlocks = useCallback(() => {
    if (!orderType) return
    const block: OrderBlock = { orderType }
    if (orderType === 'pop') block.popItems = [...popItems]
    if (orderType === 'sticker') block.stickerItems = [...stickerItems]
    if (orderType === 'dtf') block.dtfItems = [...dtfItems]
    if (orderType === 'businesscard' || orderType === 'banner') block.cardBannerItems = [...cardBannerItems]
    if (orderType === 'tshirt') block.tshirtItem = { ...tshirtItem, designImages: [...tshirtItem.designImages], kidsSizes: [...tshirtItem.kidsSizes] }
    if (editingPrependNextBlock) {
      setOrderBlocks(prev => [block, ...prev])
      setEditingPrependNextBlock(false)
    } else {
      setOrderBlocks(prev => [...prev, block])
    }
  }, [orderType, popItems, stickerItems, dtfItems, cardBannerItems, tshirtItem, editingPrependNextBlock])

  const clearCurrentProductAndGoMain = useCallback(() => {
    pushCurrentToOrderBlocks()
    setPopItems([])
    setStickerItems([])
    setDtfItems([])
    setCardBannerItems([])
    setTshirtItem(initialTshirt)
    setKidsSizeInput('')
    setKidsSizeQtyInput(0)
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

  const addCardBannerItem = useCallback(() => {
    setCardBannerItems(prev => [...prev, { size: '', quantity: 0 }])
  }, [])
  const updateCardBannerItem = useCallback((i: number, field: keyof CardBannerItem, value: string | number) => {
    setCardBannerItems(prev => prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)))
  }, [])

  const updateTshirtSize = useCallback((size: string, qty: number) => {
    setTshirtItem(prev => ({ ...prev, sizes: { ...prev.sizes, [size]: qty } }))
  }, [])

  const handleTshirtDesignUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = () =>
        setTshirtItem(prev => ({ ...prev, designImages: [...prev.designImages, reader.result as string] }))
      reader.readAsDataURL(file)
    })
  }, [])

  const generateOrder = useCallback(() => {
    const deliveryLabel =
      deliveryDate === 'other' ? deliveryDateOther : (DELIVERY_DATE_OPTIONS.find(o => o.value === deliveryDate)?.label ?? '')
    const lines: string[] = []
    lines.push('========== 발 주 서 ==========')
    lines.push('')
    if (ordererName) lines.push(`주문자: ${ordererName}`)
    if (orderChannel) lines.push(`주문채널: ${orderChannel}`)
    if (deliveryLabel) lines.push(`수령일자: ${deliveryLabel}`)
    if (orderBlocks.length) lines.push(`주문 제품: ${orderBlocks.map(b => ORDER_TYPE_LABELS[b.orderType]).join(', ')}`)
    lines.push('')

    orderBlocks.forEach((block) => {
      if (block.orderType === 'pop' && block.popItems?.length) {
        lines.push('[POP]')
        block.popItems.forEach((item, idx) => {
          let sizeLabel: string
          if (item.size === POP_CUSTOM_SIZE_VALUE && (item.customWidth || item.customHeight))
            sizeLabel = `${item.customWidth || '-'}*${item.customHeight || '-'}`
          else if (item.size === POP_OTHER_PRODUCT_VALUE)
            sizeLabel = item.customProductName ? `기타제품: ${item.customProductName}` : '기타제품'
          else sizeLabel = item.size || '-'
          const qty = typeof item.quantity === 'number' ? item.quantity : 0
          let line = `  ${idx + 1}. ${sizeLabel}/수량${qty}`
          if (item.memo?.trim()) line += ` / 메모: ${item.memo.trim()}`
          lines.push(line)
        })
        lines.push('')
      }
      if (block.orderType === 'sticker' && block.stickerItems?.length) {
        lines.push('[스티커]')
        block.stickerItems.forEach((item, idx) => {
          const mat = item.material?.trim() || '-'
          const w = item.width?.trim() || ''
          const h = item.height?.trim() || ''
          const qty = typeof item.quantity === 'number' ? item.quantity : 0
          const sizeStr = w && h ? `${w}×${h}` : ''
          const opt = sizeStr ? `${mat} ${sizeStr}` : mat
          let line = `  ${idx + 1}. ${opt}/수량${qty}`
          if (item.memo?.trim()) line += ` / 메모: ${item.memo.trim()}`
          lines.push(line)
        })
        lines.push('')
      }
      if (block.orderType === 'dtf' && block.dtfItems?.length) {
        lines.push('[DTF]')
        block.dtfItems.forEach((item, idx) => {
          const size = item.size?.trim() || '-'
          const qty = typeof item.quantity === 'number' ? item.quantity : 0
          let line = `  ${idx + 1}. ${size}/수량${qty}`
          if (item.memo?.trim()) line += ` / 메모: ${item.memo.trim()}`
          lines.push(line)
        })
        lines.push('')
      }
      if ((block.orderType === 'businesscard' || block.orderType === 'banner') && block.cardBannerItems?.length) {
        lines.push(`[${ORDER_TYPE_LABELS[block.orderType]}]`)
        block.cardBannerItems.forEach((item, idx) => {
          const size = item.size?.trim() || '-'
          const qty = typeof item.quantity === 'number' ? item.quantity : 0
          let line = `  ${idx + 1}. ${size}/수량${qty}`
          if (item.memo?.trim()) line += ` / 메모: ${item.memo.trim()}`
          lines.push(line)
        })
        lines.push('')
      }
      if (block.orderType === 'tshirt' && block.tshirtItem) {
        const ti = block.tshirtItem
        lines.push('[티셔츠]')
        const typeLabel = ti.shirtType === '그외' ? (ti.shirtTypeOther?.trim() || '그외') : (ti.shirtType || '-')
        lines.push(`  티셔츠 종류: ${typeLabel}`)
        const colorLabel = ti.color === '그외' ? (ti.colorOther?.trim() || '그외') : (ti.color || '-')
        lines.push(`  티셔츠 색상: ${colorLabel}`)
        const sizeQtys = Object.entries(ti.sizes).map(([s, q]) => `${s}: ${q}`)
        lines.push('  ' + sizeQtys.join(', '))
        if (ti.kidsSizes?.length) {
          ti.kidsSizes.forEach((k) => {
            lines.push(`  그외 ${k.size?.trim() || '-'}/수량${k.quantity ?? 0}`)
          })
        }
        if (ti.designImages?.length) lines.push('  첨부한 이미지: 있음 (디자인 등록)')
        if (ti.memo?.trim()) lines.push(`  메모: ${ti.memo.trim()}`)
        lines.push('')
        lines.push('[출력 후 펜으로 기입]')
        lines.push('  앞: 목 봉제선 아래로 __________ CM')
        lines.push('  뒤: 목 봉제선 아래로 __________ CM')
        lines.push('  인쇄 사이즈 기준 사이즈: 가로 __________ CM 기준')
        lines.push('')
      }
    })

    if (measurements.frontNeckCm || measurements.backNeckCm || measurements.printWidthCm) {
      lines.push('[측정값]')
      if (measurements.frontNeckCm) lines.push(`  앞: 목 봉제선 아래로 ${measurements.frontNeckCm} cm`)
      if (measurements.backNeckCm) lines.push(`  뒤: 목 봉제선 아래로 ${measurements.backNeckCm} cm`)
      if (measurements.printWidthCm) lines.push(`  인쇄 사이즈 기준 가로: ${measurements.printWidthCm} cm`)
      lines.push('')
    }
    if (memo.trim()) {
      lines.push('[메모]')
      lines.push(memo.trim())
      lines.push('')
    }
    lines.push('==============================')

    const fullText = lines.join('\n')
    const productLabels = orderBlocks.map(b => ORDER_TYPE_LABELS[b.orderType]).join(', ')
    const allDesignImages = orderBlocks
      .filter(b => b.orderType === 'tshirt')
      .flatMap(b => b.tshirtItem?.designImages ?? [])

    if (orderBlocks.length === 0) return
    setOrderList(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        ordererName,
        orderChannel,
        deliveryLabel: deliveryLabel || '',
        deliveryDate,
        deliveryDateOther: deliveryDateOther || '',
        orderProduct: productLabels,
        fullText,
        orderType: orderBlocks[0].orderType,
        designImages: allDesignImages,
        memo,
        orderBlocks: orderBlocks.map(b => ({
          ...b,
          popItems: b.popItems ? [...b.popItems] : undefined,
          stickerItems: b.stickerItems ? [...b.stickerItems] : undefined,
          dtfItems: b.dtfItems ? [...b.dtfItems] : undefined,
          cardBannerItems: b.cardBannerItems ? [...b.cardBannerItems] : undefined,
          tshirtItem: b.tshirtItem
            ? {
                ...b.tshirtItem,
                designImages: [...b.tshirtItem.designImages],
                kidsSizes: [...b.tshirtItem.kidsSizes],
              }
            : undefined,
        })),
      },
    ])
    setListAddMessage(true)
    setTimeout(() => setListAddMessage(false), 2000)
    setOrderBlocks([])
    setOrdererName('')
    setOrderChannel('')
    setDeliveryDate('')
    setDeliveryDateOther('')
    setOrderType(null)
    setPopItems([])
    setStickerItems([])
    setDtfItems([])
    setCardBannerItems([])
    setTshirtItem(initialTshirt)
    setKidsSizeInput('')
    setKidsSizeQtyInput(0)
    setMemo('')
    setScreen('main')
  }, [
    ordererName,
    orderChannel,
    deliveryDate,
    deliveryDateOther,
    orderBlocks,
    measurements,
    memo,
  ])

  const removeOrderFromList = useCallback((id: string) => {
    setOrderList(prev => prev.filter(item => item.id !== id))
  }, [])

  const startEditOrder = useCallback((item: OrderListItem) => {
    if (!item.orderBlocks?.length) return
    const blocks = item.orderBlocks
    const first = blocks[0]
    const rest = blocks.slice(1)

    setOrdererName(item.ordererName)
    setOrderChannel(item.orderChannel)
    setDeliveryDate(item.deliveryDate ?? '')
    setDeliveryDateOther(item.deliveryDateOther ?? '')
    setMemo(item.memo ?? '')
    setOrderBlocks(rest)
    setOrderList(prev => prev.filter(x => x.id !== item.id))
    setEditingPrependNextBlock(true)

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
                kidsSizes: [...(first.tshirtItem.kidsSizes ?? [])],
              }
            : initialTshirt
        )
        setOrderType('tshirt')
        setScreen('tshirt')
        break
    }
    setKidsSizeInput('')
    setKidsSizeQtyInput(0)
  }, [])

  const clearOrderList = useCallback(() => {
    setOrderList([])
  }, [])

  const openPrintView = useCallback(() => {
    if (orderList.length === 0) return
    const now = new Date()
    const dateStr = `${now.getMonth() + 1}/${now.getDate()}일 발주서`
    const parts: string[] = []
    parts.push('<html><head><meta charset="utf-8"><title>발주서</title><style>')
    parts.push('body{font-family:Malgun Gothic,dotum,sans-serif;font-size:13px;padding:24px;color:#000;text-align:left;line-height:1.6;}')
    parts.push('.header{margin-bottom:20px;text-align:center;font-size:14px;}')
    parts.push('.block{margin:20px 0 0;}')
    parts.push('.tshirt-img{margin:8px 0;max-width:220px;max-height:180px;display:block;}')
    parts.push('@media print{.tshirt-img{max-width:200px;max-height:150px;}}')
    parts.push('</style></head><body>')
    parts.push(`<div class="header">===================== ${dateStr} =====================</div>`)
    const fullTextWithoutHeader = (text: string) =>
      text.replace(/^========== 발 주 서 ==========\s*\n+/i, '').trimStart()

    orderList.forEach((item, i) => {
      parts.push('<div class="block">')
      const text = i === 0 ? (item.fullText || '') : fullTextWithoutHeader(item.fullText || '')
      parts.push(`<pre style="white-space:pre-wrap;margin:0;font-family:inherit;">${escapeHtml(text)}</pre>`)
      if (item.orderType === 'tshirt' && item.designImages.length > 0) {
        item.designImages.forEach((src) => {
          parts.push(`<img class="tshirt-img" src="${src}" alt="디자인" />`)
        })
      }
      parts.push('</div>')
    })
    parts.push('</body></html>')
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(parts.join(''))
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }, [orderList])

  if (screen === 'main') {
    return (
      <div className={styles.wrapper}>
        <h1 className={styles.title}>발주서 발행기</h1>

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

        <section className={styles.orderListSection}>
          <h2 className={styles.sectionTitle}>오늘 발주서 내역</h2>
          {orderList.length === 0 ? (
            <p className={styles.orderListEmpty}>발주서를 생성하면 목록에 추가됩니다.</p>
          ) : (
            <>
              <ul className={styles.orderList}>
                {orderList.map((item, i) => (
                  <li key={item.id} className={styles.orderListItem}>
                    <span>{i + 1}. {item.ordererName || '(주문자 없음)'} - {item.orderProduct}</span>
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
                        className={styles.orderListDeleteBtn}
                        onClick={() => removeOrderFromList(item.id)}
                      >
                        삭제
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <div className={styles.orderListActions}>
                <button type="button" className={styles.pdfBtn} onClick={openPrintView}>
                  PDF로 저장
                </button>
                <button type="button" className={styles.clearAllBtn} onClick={clearOrderList}>
                  전체 삭제
                </button>
              </div>
            </>
          )}
        </section>
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

        <div className={styles.sizeBlock}>
          <span className={styles.sizeLabel}>티셔츠 사이즈</span>
          <div className={styles.sizeGridVertical}>
            {TSHIRT_SIZES.map(size => (
              <label key={size} className={styles.sizeItemRow}>
                <span className={styles.sizeItemLabel}>{size}</span>
                <input
                  type="number"
                  min={0}
                  placeholder="수량"
                  value={tshirtItem.sizes[size] ?? ''}
                  onChange={e => updateTshirtSize(size, Number(e.target.value) || 0)}
                  className={styles.sizeItemInput}
                />
              </label>
            ))}
          </div>
        </div>

        <div className={`${styles.tshirtSection} ${styles.grEtcSizeSection}`}>
          <span className={styles.sizeLabel}>그외 사이즈</span>
          {tshirtItem.kidsSizes.length > 0 && (
            <ul className={styles.kidsSizeList}>
              {tshirtItem.kidsSizes.map((k, i) => (
                <li key={i} className={styles.kidsSizeListItem}>
                  <span>{k.size || '-'} / 수량 {k.quantity}</span>
                  <button
                    type="button"
                    className={styles.kidsSizeRemoveBtn}
                    onClick={() =>
                      setTshirtItem(prev => ({
                        ...prev,
                        kidsSizes: prev.kidsSizes.filter((_, idx) => idx !== i),
                      }))
                    }
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.kidsSizeRow}>
            <input
              type="text"
              placeholder="사이즈 입력 (예: 90, 95, 100...)"
              value={kidsSizeInput}
              onChange={e => setKidsSizeInput(e.target.value)}
              className={styles.tshirtOtherInput}
            />
            <label className={styles.kidsSizeQtyLabel}>
              <span>수량</span>
              <input
                type="number"
                min={0}
                value={kidsSizeQtyInput || ''}
                onChange={e => setKidsSizeQtyInput(Number(e.target.value) || 0)}
                className={styles.kidsSizeQtyInput}
              />
            </label>
            <button
              type="button"
              className={styles.kidsSizeAddBtn}
              onClick={() => {
                if (kidsSizeInput.trim() || kidsSizeQtyInput > 0) {
                  setTshirtItem(prev => ({
                    ...prev,
                    kidsSizes: [...prev.kidsSizes, { size: kidsSizeInput.trim(), quantity: kidsSizeQtyInput }],
                  }))
                  setKidsSizeInput('')
                  setKidsSizeQtyInput(0)
                }
              }}
            >
              추가
            </button>
          </div>
        </div>

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

        <label className={styles.labelBlockSummary}>
          <span className={styles.summaryLabel}>추가 지시 사항</span>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="추가 지시 사항을 입력하세요."
            rows={4}
          />
        </label>

        <div className={styles.summaryBtnRow}>
          <button type="button" className={`${styles.generateBtn} ${styles.generateBtnRed}`} onClick={generateOrder}>
            발주서 생성
          </button>
        </div>
        {listAddMessage && <p className={styles.listAddMessage}>목록에 추가되었습니다.</p>}

        <section className={styles.orderListSection}>
          <h2 className={styles.sectionTitle}>오늘 발주서 내역</h2>
          {orderList.length === 0 ? (
            <p className={styles.orderListEmpty}>발주서를 생성하면 목록에 추가됩니다.</p>
          ) : (
            <>
              <ul className={styles.orderList}>
                {orderList.map((item, i) => (
                  <li key={item.id} className={styles.orderListItem}>
                    <span>{i + 1}. {item.ordererName || '(주문자 없음)'} - {item.orderProduct}</span>
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
                        className={styles.orderListDeleteBtn}
                        onClick={() => removeOrderFromList(item.id)}
                      >
                        삭제
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <div className={styles.orderListActions}>
                <button type="button" className={styles.pdfBtn} onClick={openPrintView}>
                  PDF로 저장
                </button>
                <button type="button" className={styles.clearAllBtn} onClick={clearOrderList}>
                  전체 삭제
                </button>
              </div>
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

        <label className={styles.labelBlockSummary}>
          <span className={styles.summaryLabel}>추가 지시 사항</span>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="추가 지시 사항을 입력하세요."
            rows={4}
          />
        </label>

        <div className={styles.summaryBtnRow}>
          <button type="button" className={`${styles.generateBtn} ${styles.generateBtnRed}`} onClick={generateOrder}>
            발주서 생성
          </button>
        </div>
        {listAddMessage && <p className={styles.listAddMessage}>목록에 추가되었습니다.</p>}

        <section className={styles.orderListSection}>
          <h2 className={styles.sectionTitle}>오늘 발주서 내역</h2>
          {orderList.length === 0 ? (
            <p className={styles.orderListEmpty}>발주서를 생성하면 목록에 추가됩니다.</p>
          ) : (
            <>
              <ul className={styles.orderList}>
                {orderList.map((item, i) => (
                  <li key={item.id} className={styles.orderListItem}>
                    <span>{i + 1}. {item.ordererName || '(주문자 없음)'} - {item.orderProduct}</span>
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
                        className={styles.orderListDeleteBtn}
                        onClick={() => removeOrderFromList(item.id)}
                      >
                        삭제
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <div className={styles.orderListActions}>
                <button type="button" className={styles.pdfBtn} onClick={openPrintView}>
                  PDF로 저장
                </button>
                <button type="button" className={styles.clearAllBtn} onClick={clearOrderList}>
                  전체 삭제
                </button>
              </div>
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
