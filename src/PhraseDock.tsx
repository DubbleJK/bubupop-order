import { useEffect, useState } from 'react'
import { copyPhrase, loadPhrases, savePhrases, type QuickPhrase } from './lib/quickPhrases'
import styles from './App.module.css'

function newPhraseId(): string {
  return `phrase-${Date.now()}`
}

export function PhraseDock() {
  const [open, setOpen] = useState(false)
  const [phrases, setPhrases] = useState<QuickPhrase[]>([])
  const [notice, setNotice] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancel = false
    void loadPhrases().then(next => {
      if (!cancel) setPhrases(next)
    })
    return () => {
      cancel = true
    }
  }, [])

  const closeEditor = () => {
    setEditingId(null)
    setTitle('')
    setBody('')
  }

  const openEditor = (phrase?: QuickPhrase) => {
    setNotice('')
    setEditingId(phrase?.id ?? 'new')
    setTitle(phrase?.title ?? '')
    setBody(phrase?.body ?? '')
  }

  const persist = async (next: QuickPhrase[], message: string) => {
    setSaving(true)
    setPhrases(next)
    const ok = await savePhrases(next)
    setSaving(false)
    setNotice(ok ? message : '이 기기에는 저장했습니다. 서버 반영은 잠시 후 다시 시도해 주세요.')
    if (ok) closeEditor()
  }

  const copy = (phrase: QuickPhrase) => {
    void copyPhrase(phrase.body).then(ok => {
      setNotice(ok ? `${phrase.title} 문구를 복사했습니다.` : '복사하지 못했습니다. 문구를 길게 눌러 복사해 주세요.')
    })
  }

  const saveEditor = () => {
    const nextTitle = title.trim()
    const nextBody = body.trim()
    if (!nextTitle || !nextBody) {
      setNotice('제목과 문구를 모두 적어 주세요.')
      return
    }
    if (editingId === 'new') {
      void persist([{ id: newPhraseId(), title: nextTitle, body: nextBody }, ...phrases], '문구를 추가했습니다.')
      return
    }
    void persist(
      phrases.map(phrase => (phrase.id === editingId ? { ...phrase, title: nextTitle, body: nextBody } : phrase)),
      '문구를 수정했습니다.'
    )
  }

  const remove = (phrase: QuickPhrase) => {
    if (!window.confirm(`"${phrase.title}" 문구를 삭제할까요?`)) return
    void persist(
      phrases.filter(item => item.id !== phrase.id),
      '문구를 삭제했습니다.'
    )
  }

  return (
    <>
      <button type="button" className={styles.phraseDockBtn} onClick={() => setOpen(true)}>
        자주쓰는 대답
      </button>
      {open ? (
        <div className={styles.phraseBackdrop} onClick={() => setOpen(false)}>
          <div
            className={styles.phraseSheet}
            role="dialog"
            aria-label="자주 쓰는 문구"
            onClick={event => event.stopPropagation()}
          >
            <div className={styles.phraseSheetHead}>
              <h2 className={styles.phraseSheetTitle}>자주 쓰는 문구</h2>
              <button type="button" className={styles.orderListDeleteBtn} onClick={() => setOpen(false)}>
                닫기
              </button>
            </div>
            {notice ? <p className={styles.phraseNotice}>{notice}</p> : null}
            {editingId ? (
              <div className={styles.phraseEditor}>
                <label className={styles.phraseField}>
                  제목
                  <input value={title} onChange={event => setTitle(event.target.value)} />
                </label>
                <label className={styles.phraseField}>
                  문구
                  <textarea value={body} rows={10} onChange={event => setBody(event.target.value)} />
                </label>
                <div className={styles.phraseRowActions}>
                  <button type="button" className={styles.orderListProofBtn} onClick={saveEditor} disabled={saving}>
                    저장
                  </button>
                  <button type="button" className={styles.orderListEditBtn} onClick={closeEditor}>
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button type="button" className={styles.phraseAddBtn} onClick={() => openEditor()}>
                  문구 추가
                </button>
                <ul className={styles.phraseList}>
                  {phrases.map(phrase => (
                    <li key={phrase.id} className={styles.phraseItem}>
                      <button type="button" className={styles.phraseCopy} onClick={() => copy(phrase)}>
                        <span className={styles.phraseItemTitle}>{phrase.title}</span>
                        <span className={styles.phraseItemPreview}>{phrase.body}</span>
                      </button>
                      <div className={styles.phraseRowActions}>
                        <button type="button" className={styles.orderListEditBtn} onClick={() => openEditor(phrase)}>
                          수정
                        </button>
                        <button type="button" className={styles.orderListDeleteBtn} onClick={() => remove(phrase)}>
                          삭제
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
