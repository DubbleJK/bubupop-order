const STORAGE_KEY = 'bubupop-ledger-password'
const DEFAULT_PASSWORD = '1000'

export function getLedgerPassword(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_PASSWORD
  } catch {
    return DEFAULT_PASSWORD
  }
}

export function setLedgerPassword(password: string): void {
  localStorage.setItem(STORAGE_KEY, password)
}
