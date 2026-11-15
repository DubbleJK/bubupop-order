import { useCallback, useEffect, useRef, useState } from 'react'
import { copyImageBlob, DEFAULT_CUT_NOTE, proofDueText, proofFactsText, renderProofSheet, type ProofColumns } from './lib/proofSheet'
import type { OrderListItem } from './types'
import styles from './App.module.css'

function readImageFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image'))
    }
    img.src = url
  })
}

function imagesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return []
  const files = Array.from(data.files).filter(file => file.type.startsWith('image/'))
  if (files.length > 0) return files
  return Array.from(data.items)
    .filter(item => item.type.startsWith('image/'))
    .map(item => item.getAsFile())
    .filter((file): file is File => Boolean(file))
}

export function ProofDialog({ item, onClose }: { item: OrderListItem; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const imagesRef = useRef<HTMLImageElement[]>([])
  const columnsRef = useRef<ProofColumns>(1)
  const jobRef = useRef(0)
  const [columns, setColumns] = useState<ProofColumns>(1)
  const [showCut, setShowCut] = useState(false)
  const [cutNote, setCutNote] = useState(DEFAULT_CUT_NOTE)
  const [showDue, setShowDue] = useState(true)
  const [dueText, setDueText] = useState(() => proofDueText(item))
  const [showFacts, setShowFacts] = useState(true)
  const [factsText, setFactsText] = useState(() => proofFactsText(item))
  const [imageCount, setImageCount] = useState(0)
  const optionsRef = useRef({ showCut, cutNote, showDue, dueText, showFacts, factsText })
  optionsRef.current = { showCut, cutNote, showDue, dueText, showFacts, factsText }
  const [previewUrl, setPreviewUrl] = useState('')
  const [notice, setNotice] = useState('캡처한 이미지를 이 창에 붙여넣기 하세요. 여러 장은 이어서 붙이거나 한 번에 고를 수 있습니다.')
  const [busy, setBusy] = useState(false)
  const [blob, setBlob] = useState<Blob | null>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const rebuild = useCallback(
    async (images: HTMLImageElement[], cols: ProofColumns) => {
      if (images.length === 0) return
      const job = ++jobRef.current
      setBusy(true)
      setNotice('시안 이미지를 만들고 있습니다.')
      try {
        const options = optionsRef.current
        const next = await renderProofSheet(item, images, {
          columns: cols,
          showCutNote: options.showCut,
          cutNote: options.cutNote,
          showDue: options.showDue,
          dueText: options.dueText,
          showFacts: options.showFacts,
          factsText: options.factsText,
        })
        if (job !== jobRef.current) return
        const copied = await copyImageBlob(next)
        if (job !== jobRef.current) return
        setBlob(next)
        setPreviewUrl(URL.createObjectURL(next))
        setNotice(
          copied
            ? `캡처 ${images.length}장으로 만들었습니다. 클립보드에 복사했습니다.`
            : `캡처 ${images.length}장으로 만들었습니다. 아래 그림을 길게 누르거나 최종 시안 복사를 누르세요.`
        )
      } catch {
        if (job !== jobRef.current) return
        setNotice('이미지를 읽지 못했습니다. 캡처를 다시 붙여넣기 하세요.')
      } finally {
        if (job === jobRef.current) setBusy(false)
      }
    },
    [item]
  )

  useEffect(() => {
    if (imagesRef.current.length === 0) return
    const timer = window.setTimeout(() => {
      void rebuild(imagesRef.current, columnsRef.current)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [showCut, cutNote, showDue, dueText, showFacts, factsText, rebuild])

  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      setBusy(true)
      try {
        const loaded = await Promise.all(files.map(readImageFile))
        const next = [...imagesRef.current, ...loaded]
        imagesRef.current = next
        setImageCount(next.length)
        await rebuild(next, columnsRef.current)
      } catch {
        setBusy(false)
        setNotice('이미지를 읽지 못했습니다. 캡처를 다시 붙여넣기 하세요.')
      }
    },
    [rebuild]
  )

  const chooseColumns = (next: ProofColumns) => {
    columnsRef.current = next
    setColumns(next)
    if (imagesRef.current.length > 0) void rebuild(imagesRef.current, next)
  }

  const clearImages = () => {
    imagesRef.current = []
    setImageCount(0)
    setBlob(null)
    setPreviewUrl('')
    setNotice('캡처한 이미지를 이 창에 붙여넣기 하세요. 여러 장은 이어서 붙이거나 한 번에 고를 수 있습니다.')
  }

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = imagesFromClipboard(event.clipboardData)
      if (files.length === 0) return
      event.preventDefault()
      void addFiles(files)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('paste', onPaste)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('keydown', onKey)
    }
  }, [addFiles, onClose])

  return (
    <div className={styles.proofBackdrop} onClick={onClose}>
      <div
        className={styles.proofDialog}
        role="dialog"
        aria-label="시안 이미지"
        onClick={event => event.stopPropagation()}
      >
        <h2 className={styles.proofTitle}>시안 이미지</h2>
        <p className={styles.proofHint}>{item.ordererName || '주문자 없음'} · {item.orderProduct || '품목'}</p>
        <p className={styles.proofNotice}>{notice}</p>
        <div className={styles.proofOptions}>
          <div className={styles.proofOption}>
            <input type="checkbox" checked={showCut} aria-label="재단선 안내 표시" onChange={event => setShowCut(event.target.checked)} />
            <input
              type="text"
              value={cutNote}
              aria-label="재단선 안내"
              onChange={event => setCutNote(event.target.value)}
            />
          </div>
          <div className={styles.proofOption}>
            <input type="checkbox" checked={showDue} aria-label="납기일 표시" onChange={event => setShowDue(event.target.checked)} />
            <input
              type="text"
              value={dueText}
              aria-label="납기일"
              onChange={event => setDueText(event.target.value)}
            />
          </div>
          <div className={styles.proofOption}>
            <input type="checkbox" checked={showFacts} aria-label="주문 내용 표시" onChange={event => setShowFacts(event.target.checked)} />
            <textarea
              value={factsText}
              aria-label="주문 내용"
              rows={5}
              onChange={event => setFactsText(event.target.value)}
            />
          </div>
        </div>
        <div className={styles.proofColumns}>
          <button
            type="button"
            className={`${styles.proofColumnBtn} ${columns === 1 ? styles.proofColumnBtnOn : ''}`}
            aria-pressed={columns === 1}
            disabled={busy}
            onClick={() => chooseColumns(1)}
          >
            1열
          </button>
          <button
            type="button"
            className={`${styles.proofColumnBtn} ${columns === 2 ? styles.proofColumnBtnOn : ''}`}
            aria-pressed={columns === 2}
            disabled={busy}
            onClick={() => chooseColumns(2)}
          >
            2열
          </button>
        </div>
        <div className={styles.proofActions}>
          <button type="button" className={styles.orderListProofBtn} onClick={() => fileRef.current?.click()} disabled={busy}>
            이미지 선택
          </button>
          <button type="button" className={styles.orderListEditBtn} onClick={clearImages} disabled={busy || imageCount === 0}>
            캡처 지우기
          </button>
          <button
            type="button"
            className={styles.orderListEditBtn}
            disabled={!blob || busy}
            onClick={() => {
              if (!blob) return
              void copyImageBlob(blob).then(ok => {
                setNotice(ok ? '클립보드에 복사했습니다. 카카오톡에 붙여넣기 하세요.' : '복사하지 못했습니다. 아래 그림을 직접 복사해 주세요.')
              })
            }}
          >
            최종 시안 복사
          </button>
          <button type="button" className={styles.orderListDeleteBtn} onClick={onClose}>
            닫기
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className={styles.proofFile}
          onChange={event => {
            const files = Array.from(event.target.files ?? [])
            event.target.value = ''
            if (files.length > 0) void addFiles(files)
          }}
        />
        {previewUrl ? <img src={previewUrl} alt="만들어진 시안" className={styles.proofPreview} /> : null}
      </div>
    </div>
  )
}
