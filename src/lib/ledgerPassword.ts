import { supabase } from './supabase'

const STORAGE_KEY = 'bubupop-ledger-password'
const DEFAULT_PASSWORD = '1000'
const HASH_RE = /^[a-f0-9]{64}$/

/** 발주서 목록에 섞이지 않는 설정 행. 날짜가 1970이라 가계부·인쇄 목록에 나오지 않는다. */
export const LEDGER_PASSWORD_ROW_ID = '__settings_ledger_password__'
const SETTINGS_DATE = '1970-01-01'

async function digest(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(buf))
    .map(value => value.toString(16).padStart(2, '0'))
    .join('')
}

function readCachedSecret(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

function cacheHash(hash: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, hash)
  } catch {
    /* 저장 공간이 없어도 이번 화면의 확인은 계속한다 */
  }
}

function storedSecret(orderData: unknown): string {
  if (!orderData || typeof orderData !== 'object') return ''
  const row = orderData as { passwordHash?: unknown; password?: unknown }
  if (typeof row.passwordHash === 'string') return row.passwordHash
  if (typeof row.password === 'string') return row.password
  return ''
}

async function matchesStored(input: string, stored: string): Promise<boolean> {
  if (HASH_RE.test(stored)) return (await digest(input)) === stored
  return input === stored
}

async function saveHash(hash: string): Promise<boolean> {
  if (!supabase) {
    cacheHash(hash)
    return true
  }
  const { error } = await supabase.from('orders').upsert(
    {
      id: LEDGER_PASSWORD_ROW_ID,
      date_key: SETTINGS_DATE,
      order_data: { passwordHash: hash },
    },
    { onConflict: 'id' }
  )
  if (error) return false
  cacheHash(hash)
  return true
}

/** 입력한 비밀번호가 공통 비밀번호와 같은지 확인한다. 서버에는 해시만 둔다. */
export async function matchesSharedLedgerPassword(input: string): Promise<{ ok: boolean; shared: boolean }> {
  if (!supabase) {
    const stored = readCachedSecret() || DEFAULT_PASSWORD
    const ok = await matchesStored(input, stored)
    if (ok) cacheHash(await digest(input))
    return { ok, shared: false }
  }

  const { data, error } = await supabase
    .from('orders')
    .select('order_data')
    .eq('id', LEDGER_PASSWORD_ROW_ID)
    .maybeSingle()
  if (error) {
    const stored = readCachedSecret() || DEFAULT_PASSWORD
    const ok = await matchesStored(input, stored)
    if (ok) cacheHash(await digest(input))
    return { ok, shared: false }
  }

  const stored = storedSecret(data?.order_data)
  const ok = await matchesStored(input, stored || DEFAULT_PASSWORD)
  if (!ok) return { ok: false, shared: true }

  const hash = await digest(input)
  cacheHash(hash)
  if (!HASH_RE.test(stored)) await saveHash(hash)
  return { ok: true, shared: true }
}

/** 공통 비밀번호를 해시로 저장한다. 서버 저장에 실패하면 false. */
export async function writeSharedLedgerPassword(password: string): Promise<boolean> {
  const hash = await digest(password)
  return saveHash(hash)
}
