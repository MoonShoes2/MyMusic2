import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLibrary } from '../store/useStore'
import { TopBar, EmptyBox, toast, Icon } from '../components/common'
import { encodePlaylist, decodePlaylist } from '../lib/utils'

export default function Transfer() {
  const { mode = 'export' } = useParams()
  const nav = useNavigate()
  const isExport = mode === 'export'
  const likedSongs = useLibrary((s) => s.likedSongs)
  const importSongs = useLibrary((s) => s.importSongs)

  const [text, setText] = useState('')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)
  const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null)

  const doExport = async () => {
    const t = await encodePlaylist(likedSongs)
    setText(t)
    return t
  }

  const copy = async () => {
    const t = text || await doExport()
    await navigator.clipboard?.writeText(t)
    toast('已复制')
  }

  const saveFile = async () => {
    const t = text || await doExport()
    const blob = new Blob([t], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `MyMusic2歌单_${likedSongs.length}首.txt`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10000)
    toast('已保存')
  }

  const doImport = async () => {
    if (!text.trim()) { setResult('请先粘贴导出的歌单文本'); return }
    setBusy(true); setResult('导入中…')
    try {
      const songs = await decodePlaylist(text)
      if (!songs || songs.length === 0) {
        setResult('未识别到有效歌曲：内容可能不完整，或来自更高版本的 App')
      } else {
        const added = importSongs(songs)
        setResult(`导入完成：新增收藏 ${added} 首，跳过已存在 ${songs.length - added} 首`)
      }
    } catch (e: any) {
      setResult(`导入失败：${e?.message || '未知错误'}`)
    } finally { setBusy(false) }
  }

  const readFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => { setText(String(reader.result || '')); setResult('') }
    reader.onerror = () => toast('读取文件失败或内容为空')
    reader.readAsText(file, 'utf-8')
  }

  if (isExport && likedSongs.length === 0) {
    return <div className="page"><TopBar title="导出收藏歌单" onBack={() => nav(-1)} /><EmptyBox text="收藏列表为空，无法导出" /></div>
  }

  return (
    <div className="page">
      <TopBar title={isExport ? '导出收藏歌单' : '导入歌单'} onBack={() => nav(-1)} />
      <div className="scroll-area transfer-page">
        {isExport ? (
          <>
            <div className="transfer-intro">
              <div>共 {likedSongs.length} 首歌曲</div>
              <p>可复制文本或保存文件，在其他设备的「导入歌单」中粘贴导入。</p>
            </div>
            <textarea className="share-text" readOnly placeholder="点击下方按钮生成歌单文本"
              value={text || (likedSongs.length ? '（点击下方按钮生成导出文本）' : '')} />
            <div className="transfer-actions">
              <button className="btn" onClick={copy}><Icon name="share" size={18} />复制文本</button>
              <button className="btn-outline" onClick={saveFile}><Icon name="download" size={18} />存文件</button>
            </div>
          </>
        ) : (
          <>
            <textarea className="import-text" placeholder="粘贴导出的歌单文本，或选择文件自动填入"
              value={text} onChange={(e) => setText(e.target.value)} />
            <p className="hint">歌单文本可直接粘贴，重复导入不会重复收藏。</p>
            <div className="transfer-actions">
              <button className="btn" disabled={busy} onClick={doImport}>{busy ? '导入中…' : '开始导入'}</button>
              <button className="btn-outline" onClick={() => fileInput?.click()}>从文件导入</button>
            </div>
            <input type="file" accept=".txt,text/plain" style={{ display: 'none' }}
              ref={(el) => setFileInput(el)}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f) }} />
            {result && <div className="import-result">{result}</div>}
          </>
        )}
      </div>
    </div>
  )
}
