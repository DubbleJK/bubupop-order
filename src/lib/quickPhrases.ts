import { supabase } from './supabase'

export interface QuickPhrase {
  id: string
  title: string
  body: string
}

const STORAGE_KEY = 'bubupop-quick-phrases'
const ROW_ID = '__settings_quick_phrases__'
const SETTINGS_DATE = '1970-01-01'

interface PhraseStore {
  phrases: QuickPhrase[]
  updatedAt: string
}

export const DEFAULT_PHRASES: QuickPhrase[] = [
  {
    id: 'proof',
    title: '시안 안내',
    body: `🎨 부부피오피 디자인 시안 안내

안녕하세요! 요청하신 1차 디자인 시안을 보내드립니다. 😊

📌 시안 확인 시 꼭 확인해 주세요.

① 이름·문구·연락처 등 오탈자 확인
② 색상·크기·배치 등 디자인 확인
③ 수정 사항은 한 번에 정리해서 전달

✅ 기본 수정은 총 1회 가능합니다.
✅ 추가 수정 및 디자인 변경 시 별도 비용이 발생할 수 있습니다.
✅ 수정 내용에 따라 제작 일정이 변경될 수 있습니다.

⚠️ 중요 안내
시안 확정 후 제작이 시작되면 수정이 어렵습니다.

최종 시안을 꼼꼼히 확인하신 후, 이상이 없으시면 "시안 확정합니다"라고 답변 부탁드립니다.

확인 후 제작을 진행하겠습니다.

감사합니다.
부부피오피 💛`,
  },
  {
    id: 'ship',
    title: '발송 안내',
    body: `📦 부부피오피 발송 안내

고객님, 주문하신 제품이 제작 완료되어 발송되었습니다! 😊
소중한 주문에 진심으로 감사드립니다.

✅ 제품 수령 후 이상이 있다면 사진과 함께 문의해 주세요.
✅ 동일 제품 재주문이나 추가 제작도 편하게 문의해 주세요.

앞으로도 꼼꼼한 제작과 빠른 납품으로 보답하겠습니다.

감사합니다.
부부피오피 💛`,
  },
  {
    id: 'pickup',
    title: '방문 수령',
    body: `📦 부부피오피 방문 수령 안내

고객님, 주문하신 제품의 제작이 완료되었습니다! 😊

방문 수령이 가능하오니 편하신 시간에 방문해 주세요.

📍 수령 장소 : 부부피오피 [부산시 연제구 연미로 14 동덕현대아파트 상가 302호]
https://www.bubupop.com/location

📌 방문 전 수령 가능 시간을 확인해 주시면 감사하겠습니다.

소중한 주문에 감사드리며, 제품 수령 후 궁금하신 점이 있다면 언제든 문의해 주세요.

감사합니다.
부부피오피 💛`,
  },
  {
    id: 'production',
    title: '제작 진행',
    body: `네, 감사합니다. 😊
확정해 주신 시안을 기준으로 제작을 진행하겠습니다.
📌 제작 진행 후에는 디자인 및 문구 수정이 어려우니 양해 부탁드립니다.
인쇄 전 확인하신 오탈자 및 문구 오류는 제작 완료 후 수정 시 재제작 비용이 발생할 수 있습니다.
제작이 완료되면 다시 안내드리겠습니다. 감사합니다.
- 부부피오피 -`,
  },
  {
    id: 'paid',
    title: '입금 확인',
    body: `✅ 부부피오피 주문 확인 안내

고객님, 결제 확인되었습니다.
소중한 주문 감사합니다! 😊

확정된 디자인과 주문 내용을 기준으로 제작을 진행하겠습니다.

📌 제작이 시작된 후에는 디자인 변경이나 주문 취소가 어려울 수 있습니다.

제작 완료 후 수령 또는 배송 관련 내용을 다시 안내드리겠습니다.

꼼꼼하게 제작하겠습니다.
감사합니다! 💛`,
  },
  {
    id: 'weekend',
    title: '주말 휴무',
    body: `안녕하세요! 😊 부부피오피입니다.

문의해 주셔서 감사합니다.

📢 토요일·일요일은 정기 휴무일로 제작 업무가 어렵습니다.

빠른 상담을 위해 아래 내용을 남겨주세요.

✅ 제작 품목 :
✅ 제작 수량 및 사이즈 :
✅ 희망 수령일 :
✅ 디자인 파일 또는 참고 이미지 :

남겨주신 문의는 다음 영업일에 순차적으로 확인하여 안내해 드리겠습니다.

급한 제작 문의도 가능 여부를 확인한 후 안내해 드리겠습니다.

감사합니다.
부부피오피 💛`,
  },
  {
    id: 'ai-image',
    title: 'AI 이미지',
    body: `🎨 AI 이미지 파일 안내드립니다.
보내주신 이미지는 배경이 포함되어 있어 그대로 인쇄하면 배경까지 함께 출력될 수 있습니다.

ChatGPT에서 이미지를 만드셨다면 아래와 같이 요청해 주세요.

✅ "이 이미지의 디자인은 그대로 유지하고, 배경만 투명하게 제거해서 고해상도 PNG 파일로 만들어줘."

📌 작업 후에는 투명 배경이 적용된 PNG 원본 파일을 저장하여 보내주세요.
※ 흰색 배경이나 체크무늬가 이미지에 포함된 경우 실제 투명 배경이 아닐 수 있습니다.
※ AI로 만든 이미지도 해상도와 디자인 상태에 따라 별도의 편집 작업이 필요할 수 있습니다. 😊`,
  },
  {
    id: 'email',
    title: '이메일 안내',
    body: `📩 부부피오피 디자인 파일 접수 안내

인쇄 및 제작에 필요한 디자인 파일은 아래 이메일로 보내주세요.

📧 beautyfont@naver.com

✅ 권장 파일 : AI, PDF, 고해상도 PNG (300dpi로 저장해주세요.)
✅ 메일 제목 : 주문자명 / 제작 품목
✅ 파일과 함께 제작 수량 및 사이즈를 기재해 주세요.

📌 파일 발송 후 카카오톡으로 알려주시면 확인 후 안내해 드리겠습니다.

※ 파일 상태에 따라 추가 편집이나 디자인 작업 비용이 발생할 수 있습니다.

감사합니다. 😊`,
  },
  {
    id: 'kb-account',
    title: '국민은행 계좌',
    body: `💳 부부피오피 입금 안내드립니다.

주문 제작 상품은 입금 확인 후 제작이 진행됩니다.

🏦 입금 계좌
국민은행 111101-04-185578
예금주 : 박진아

📌 입금 후 입금자명을 알려주시면 빠르게 확인해 드리겠습니다.

※ 제작 일정은 입금 및 최종 디자인 확정 후 안내된 일정에 따라 진행됩니다.

감사합니다. 😊
부부피오피`,
  },
  {
    id: 'nh-account',
    title: '농협 계좌',
    body: `💳 부부피오피 입금 안내드립니다.

주문 제작 상품은 입금 확인 후 제작이 진행됩니다.

🏦 입금 계좌
농협은행 947-12-429804
예금주 : 정종관

📌 입금 후 입금자명을 알려주시면 빠르게 확인해 드리겠습니다.

※ 제작 일정은 입금 및 최종 디자인 확정 후 안내된 일정에 따라 진행됩니다.

감사합니다. 😊
부부피오피`,
  },
]

function isPhrase(value: unknown): value is QuickPhrase {
  if (!value || typeof value !== 'object') return false
  const row = value as QuickPhrase
  return typeof row.id === 'string' && typeof row.title === 'string' && typeof row.body === 'string'
}

function parseStore(raw: unknown): PhraseStore | null {
  if (!raw || typeof raw !== 'object') return null
  const store = raw as PhraseStore
  if (!Array.isArray(store.phrases) || typeof store.updatedAt !== 'string') return null
  const phrases = store.phrases.filter(isPhrase)
  if (phrases.length !== store.phrases.length) return null
  return { phrases, updatedAt: store.updatedAt }
}

function readLocal(): PhraseStore | null {
  try {
    return parseStore(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'))
  } catch {
    return null
  }
}

function writeLocal(store: PhraseStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* 이 기기 저장이 안 되어도 화면의 문구는 유지한다 */
  }
}

async function writeServer(store: PhraseStore): Promise<boolean> {
  if (!supabase) return true
  const { error } = await supabase.from('orders').upsert({
    id: ROW_ID,
    date_key: SETTINGS_DATE,
    order_data: store,
  })
  if (error) {
    console.warn('[quickPhrases] save error', error)
    return false
  }
  return true
}

export async function loadPhrases(): Promise<QuickPhrase[]> {
  const local = readLocal()
  if (!supabase) return local?.phrases?.length ? local.phrases : DEFAULT_PHRASES
  const { data, error } = await supabase.from('orders').select('order_data').eq('id', ROW_ID).maybeSingle()
  if (error) return local?.phrases?.length ? local.phrases : DEFAULT_PHRASES
  const remote = parseStore(data?.order_data)
  if (!remote) {
    const phrases = local?.phrases?.length ? local.phrases : DEFAULT_PHRASES
    const store = { phrases, updatedAt: local?.updatedAt || new Date().toISOString() }
    writeLocal(store)
    void writeServer(store)
    return phrases
  }
  if (local && local.updatedAt > remote.updatedAt) {
    void writeServer(local)
    return local.phrases
  }
  writeLocal(remote)
  return remote.phrases
}

export async function savePhrases(phrases: QuickPhrase[]): Promise<boolean> {
  const store = { phrases, updatedAt: new Date().toISOString() }
  writeLocal(store)
  return writeServer(store)
}

export async function copyPhrase(body: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(body)
    return true
  } catch {
    return false
  }
}
