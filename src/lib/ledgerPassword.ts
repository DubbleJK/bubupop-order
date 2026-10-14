import { supabase } from './supabase'

const STORAGE_KEY = 'bubupop-ledger-password'
const DEFAULT_PASSWORD = '1000'
const HASH_RE = /^[a-f0-9]{64}$/
export const LEDGER_PASSWORD_ROW_ID = '__settings_ledger_password__'
const PASSWORD_ROW_ID = LEDGER_PASSWORD_ROW_ID
const SETTINGS_DATE = '1970-01-01'

let sessionPassword = ''

export function getLedgerSession(): string {
  return sessionPassword
}

function remember(password: string): void {
  sessionPassword = password
}

function isMissingRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const text = `${error.code ?? ''} ${error.message ?? ''}`
  return text.includes('PGRST202') || text.includes('schema cache')
}

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
    /* 이 기기 저장이 안 되어도 서버 확인은 계속한다 */
  }
}

async function matchesStored(input: string, stored: string): Promise<boolean> {
  if (HASH_RE.test(stored)) return (await digest(input)) === stored
  return input === stored
}

/** 보안 함수가 생기기 전 서버에서만 쓰는 확인 */
async function matchesLegacy(input: string): Promise<boolean> {
  if (!supabase) {
    const stored = readCachedSecret() || DEFAULT_PASSWORD
    const ok = await matchesStored(input, stored)
    if (ok) {
      remember(input)
      cacheHash(await digest(input))
    }
    return ok
  }
  const { data, error } = await supabase.from('orders').select('order_data').eq('id', PASSWORD_ROW_ID).maybeSingle()
  if (error) {
    const stored = readCachedSecret() || DEFAULT_PASSWORD
    const ok = await matchesStored(input, stored)
    if (ok) remember(input)
    return ok
  }
  const raw = data?.order_data as { passwordHash?: unknown; password?: unknown } | undefined
  const stored = typeof raw?.passwordHash === 'string' ? raw.passwordHash : typeof raw?.password === 'string' ? raw.password : ''
  const ok = await matchesStored(input, stored || DEFAULT_PASSWORD)
  if (!ok) return false
  remember(input)
  const hash = await digest(input)
  cacheHash(hash)
  if (!HASH_RE.test(stored)) {
    await supabase.from('orders').upsert(
      { id: PASSWORD_ROW_ID, date_key: SETTINGS_DATE, order_data: { passwordHash: hash } },
      { onConflict: 'id' }
    )
  }
  return true
}

/** 입력한 비밀번호가 공통 비밀번호와 같은지 서버에서 확인한다. */
export async function matchesSharedLedgerPassword(input: string): Promise<{ ok: boolean; shared: boolean }> {
  if (!supabase) return { ok: await matchesLegacy(input), shared: false }
  const { data, error } = await supabase.rpc('check_ledger_password', { pw: input })
  if (!error) {
    const ok = data === true
    if (ok) remember(input)
    return { ok, shared: true }
  }
  if (!isMissingRpc(error)) return { ok: false, shared: true }
  return { ok: await matchesLegacy(input), shared: true }
}

/** 공통 비밀번호를 바꾼다. 서버 저장에 실패하면 false. */
export async function writeSharedLedgerPassword(current: string, password: string): Promise<boolean> {
  if (!supabase) {
    if (!(await matchesLegacy(current))) return false
    remember(password)
    cacheHash(await digest(password))
    return true
  }
  const { error } = await supabase.rpc('set_ledger_password', { current_pw: current, new_pw: password })
  if (!error) {
    remember(password)
    return true
  }
  if (!isMissingRpc(error)) return false
  if (!(await matchesLegacy(current))) return false
  const hash = await digest(password)
  const { error: writeError } = await supabase.from('orders').upsert(
    { id: PASSWORD_ROW_ID, date_key: SETTINGS_DATE, order_data: { passwordHash: hash } },
    { onConflict: 'id' }
  )
  if (writeError) return false
  remember(password)
  cacheHash(hash)
  return true
}
