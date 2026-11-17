import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useSettings, useLibrary } from '../store/useStore'
import { TopBar, Dialog, toast, Icon } from '../components/common'

const darkLabels: Record<string, string> = { system: '跟随系统', light: '浅色', dark: '深色' }

export default function Settings() {
  const nav = useNavigate()
  const darkMode = useSettings((s) => s.darkMode)
  const cycleDarkMode = useSettings((s) => s.cycleDarkMode)
  const lyricOffset = useSettings((s) => s.lyricOffset)
  const setLyricOffset = useSettings((s) => s.setLyricOffset)
  const nickname = useLibrary((s) => s.nickname)
  const setNickname = useLibrary((s) => s.setNickname)
  const avatar = useLibrary((s) => s.avatar)
  const setAvatar = useLibrary((s) => s.setAvatar)

  const [showNickname, setShowNickname] = useState(false)
  const [nickInput, setNickInput] = useState('')
  const [showOffset, setShowOffset] = useState(false)
  // 头像流程（对齐原 App）：来源选择 → 相册裁剪 / 随机预览
  const [showSource, setShowSource] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [showRandom, setShowRandom] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const pickFile = () => {
    setShowSource(false)
    fileRef.current?.click()
  }

  return (
    <div className="page">
      <TopBar title="设置" onBack={() => nav(-1)} />
      <div className="scroll-area">
        <div className="settings-group">
          <div className="settings-row" onClick={() => setShowSource(true)}>
            <div className="settings-row-text">
              <div className="settings-title">头像</div>
              <div className="settings-sub">从相册选择裁剪，或随机换一个</div>
            </div>
            {avatar ? <img className="settings-avatar" src={avatar} alt="头像" /> : <Icon name="person" size={28} />}
            <Icon name="chevron" size={18} />
          </div>
          <div className="settings-row" onClick={() => { setNickInput(nickname); setShowNickname(true) }}>
            <div className="settings-row-text">
              <div className="settings-title">昵称</div>
              <div className="settings-sub">{nickname || '未设置'}</div>
            </div>
            <Icon name="chevron" size={18} />
          </div>
        </div>

        <div className="settings-group">
          <div className="settings-row" onClick={cycleDarkMode}>
            <div className="settings-row-text">
              <div className="settings-title">深色模式</div>
            </div>
            <span className="settings-value">{darkLabels[darkMode]}</span>
            <Icon name="chevron" size={18} />
          </div>
          <div className="settings-row" onClick={() => setShowOffset(true)}>
            <div className="settings-row-text">
              <div className="settings-title">歌词偏移</div>
              <div className="settings-sub">正值 = 歌词延后显示，范围 ±3 秒</div>
            </div>
            <span className="settings-value">{lyricOffset === 0 ? '无偏移' : `${(lyricOffset / 1000).toFixed(1)} 秒`}</span>
            <Icon name="chevron" size={18} />
          </div>
        </div>

        <div className="settings-group">
          <div className="settings-row" onClick={() => nav('/transfer/export')}>
            <div className="settings-row-text">
              <div className="settings-title">导出收藏歌单</div>
              <div className="settings-sub">文本 / 文件，分享给其他设备</div>
            </div>
            <Icon name="chevron" size={18} />
          </div>
          <div className="settings-row" onClick={() => nav('/transfer/import')}>
            <div className="settings-row-text">
              <div className="settings-title">导入歌单</div>
              <div className="settings-sub">粘贴文本或从文件导入</div>
            </div>
            <Icon name="chevron" size={18} />
          </div>
        </div>

        <div className="settings-footer">MyMusic2 · 多音源音乐播放器（Web）</div>
      </div>

      {/* 相册文件选择（隐藏，选取后进裁剪页） */}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          const reader = new FileReader()
          reader.onload = () => setCropSrc(String(reader.result))
          reader.onerror = () => toast('图片读取失败')
          reader.readAsDataURL(f)
        }} />

      {showNickname && (
        <Dialog title="昵称" confirmText="确定"
          content={<input className="dialog-input" maxLength={20} autoFocus value={nickInput} onChange={(e) => setNickInput(e.target.value)} />}
          onClose={() => setShowNickname(false)}
          onConfirm={() => { setNickname(nickInput.trim()); setShowNickname(false); toast('已保存') }} />
      )}
      {showOffset && (
        <Dialog title="歌词偏移" confirmText="完成"
          content={
            <div className="offset-dialog">
              <div className="offset-value">{lyricOffset === 0 ? '无偏移' : `${(lyricOffset / 1000).toFixed(1)} 秒`}</div>
              <div className="offset-buttons">
                <button className="btn-outline" onClick={() => setLyricOffset(lyricOffset - 500)}>-0.5 秒</button>
                <button className="btn-outline" onClick={() => setLyricOffset(lyricOffset + 500)}>+0.5 秒</button>
              </div>
              <button className="btn-text" onClick={() => setLyricOffset(0)}>恢复默认（0）</button>
              <p className="hint">正值 = 歌词延后显示；每次调整立即保存。</p>
            </div>
          }
          onClose={() => setShowOffset(false)} onConfirm={() => setShowOffset(false)} />
      )}

      {/* 来源选择弹窗（对齐原 App AvatarSourceDialog：居中小卡片，两行） */}
      {showSource && (
        <div className="dialog-backdrop" onClick={() => setShowSource(false)}>
          <div className="avatar-source-card" onClick={(e) => e.stopPropagation()}>
            <button className="avatar-source-row" onClick={pickFile}>
              <Icon name="image" size={20} /> 从相册选择
            </button>
            <button className="avatar-source-row" onClick={() => { setShowSource(false); setShowRandom(true) }}>
              <Icon name="refresh" size={20} /> 随机换一个
            </button>
          </div>
        </div>
      )}

      {/* 裁剪页（对齐原 App AvatarCropDialog：全屏黑底、方框居中、框外压暗、白圈） */}
      {cropSrc && (
        <AvatarCrop src={cropSrc}
          onCancel={() => setCropSrc(null)}
          onSaved={(dataUrl) => {
            setCropSrc(null)
            setAvatar(dataUrl)
            toast('头像已更新')
          }} />
      )}

      {/* 随机头像预览（对齐原 App AvatarRandomPreview：全屏查看 + 换一张 / 使用这张） */}
      {showRandom && (
        <AvatarRandom onClose={() => setShowRandom(false)}
          onUse={(url) => { setShowRandom(false); setAvatar(url); toast('头像已更新') }} />
      )}
    </div>
  )
}

/* ---------- 裁剪页：图片铺满宽度方形框，拖动/缩放，白圈内即头像 ---------- */
function AvatarCrop({ src, onCancel, onSaved }: { src: string; onCancel: () => void; onSaved: (dataUrl: string) => void }) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [ready, setReady] = useState(false)
  const viewRef = useRef<HTMLDivElement>(null)
  const st = useRef({ scale: 1, x: 0, y: 0, init: false })
  const [saving, setSaving] = useState(false)

  const SIZE = 512 // 输出尺寸

  // 计算 cover 基准缩放并居中
  const initPos = () => {
    const img = imgRef.current, view = viewRef.current
    if (!img || !view) return
    const W = view.clientWidth, H = view.clientHeight
    const side = W
    const base = Math.max(side / img.naturalWidth, side / img.naturalHeight)
    const s = st.current
    if (!s.init) { s.scale = 1; s.init = true }
    s.x = (side - img.naturalWidth * base * s.scale) / 2
    s.y = (H - side) / 2 + (side - img.naturalHeight * base * s.scale) / 2
    apply(img, view, base)
  }

  const apply = (img: HTMLImageElement, view: HTMLDivElement, base: number) => {
    const W = view.clientWidth, H = view.clientHeight
    const side = W
    const s = st.current
    const k = base * s.scale
    const w = img.naturalWidth * k, h = img.naturalHeight * k
    const top = (H - side) / 2
    // 夹紧：图片必须始终盖住方形裁剪框
    s.x = Math.min(0, Math.max(side - w, s.x))
    s.y = Math.min(top, Math.max(top + side - h, s.y))
    img.style.transform = `translate(${s.x}px, ${s.y}px) scale(${k})`
    img.style.transformOrigin = '0 0'
  }

  const baseOf = () => {
    const img = imgRef.current, view = viewRef.current
    if (!img || !view) return 1
    return Math.max(view.clientWidth / img.naturalWidth, view.clientWidth / img.naturalHeight)
  }

  useEffect(() => {
    if (!ready) return
    initPos()
    const onResize = () => initPos()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  // 拖动 + 滚轮缩放 + 双指捏合
  useEffect(() => {
    const view = viewRef.current
    if (!view || !ready) return
    let dragging = false
    let lastX = 0, lastY = 0
    let pinchDist = 0

    const clampApply = () => {
      const img = imgRef.current!
      apply(img, view, baseOf())
    }
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return // 触摸走 touch 事件（双指）
      dragging = true; lastX = e.clientX; lastY = e.clientY
      view.setPointerCapture(e.pointerId)
    }
    const onMoveP = (e: PointerEvent) => {
      if (!dragging) return
      const s = st.current
      s.x += e.clientX - lastX; s.y += e.clientY - lastY
      lastX = e.clientX; lastY = e.clientY
      clampApply()
    }
    const onUpP = () => { dragging = false }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const s = st.current
      const next = Math.min(6, Math.max(1, s.scale * (e.deltaY < 0 ? 1.1 : 0.9)))
      if (next !== s.scale) { s.scale = next; clampApply() }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      const s = st.current
      if (pinchDist > 0) {
        const next = Math.min(6, Math.max(1, s.scale * (dist / pinchDist)))
        if (next !== s.scale) { s.scale = next; clampApply() }
      }
      pinchDist = dist
    }
    const onTouchEnd = () => { pinchDist = 0 }
    view.addEventListener('pointerdown', onDown)
    view.addEventListener('pointermove', onMoveP)
    view.addEventListener('pointerup', onUpP)
    view.addEventListener('pointercancel', onUpP)
    view.addEventListener('wheel', onWheel, { passive: false })
    view.addEventListener('touchmove', onTouchMove, { passive: false })
    view.addEventListener('touchend', onTouchEnd)
    return () => {
      view.removeEventListener('pointerdown', onDown)
      view.removeEventListener('pointermove', onMoveP)
      view.removeEventListener('pointerup', onUpP)
      view.removeEventListener('pointercancel', onUpP)
      view.removeEventListener('wheel', onWheel)
      view.removeEventListener('touchmove', onTouchMove)
      view.removeEventListener('touchend', onTouchEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  const confirm = () => {
    const img = imgRef.current, view = viewRef.current
    if (!img || !view || saving) return
    setSaving(true)
    try {
      const W = view.clientWidth, H = view.clientHeight
      const side = W, top = (H - side) / 2
      const k = baseOf() * st.current.scale
      const sx = Math.max(0, Math.min(img.naturalWidth - 1, Math.round(-st.current.x / k)))
      const sy = Math.max(0, Math.min(img.naturalHeight - 1, Math.round((top - st.current.y) / k)))
      const cropSide = Math.max(1, Math.min(Math.round(side / k), img.naturalWidth - sx, img.naturalHeight - sy))
      const canvas = document.createElement('canvas')
      canvas.width = SIZE; canvas.height = SIZE
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, sx, sy, cropSide, cropSide, 0, 0, SIZE, SIZE)
      onSaved(canvas.toDataURL('image/jpeg', 0.9))
    } catch {
      toast('头像保存失败，请重试')
      setSaving(false)
    }
  }

  return (
    <div className="crop-overlay">
      <div className="crop-view" ref={viewRef}>
        <img ref={imgRef} src={src} alt="裁剪" draggable={false}
          onLoad={() => setReady(true)}
          onError={() => { toast('图片读取失败'); onCancel() }} />
      </div>
      {/* 方框外压暗 + 白圈（CSS 实现） */}
      <div className="crop-mask" />
      <div className="crop-topbar">
        <button className="crop-btn" onClick={onCancel} disabled={saving}>取消</button>
        <span className="crop-flex" />
        <button className="crop-btn" onClick={confirm} disabled={saving || !ready}>{saving ? '保存中…' : '选取'}</button>
      </div>
      <div className="crop-hint">拖动或双指缩放，白圈内的部分就是头像</div>
    </div>
  )
}

/* ---------- 随机头像预览：全屏查看 + 换一张 / 使用这张 ---------- */
function AvatarRandom({ onClose, onUse }: { onClose: () => void; onUse: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)

  const fetch = () => {
    setLoading(true)
    api.randomAvatar()
      .then((u) => setUrl(u))
      .catch(() => { toast('获取随机头像失败，请检查网络'); onClose() })
      .finally(() => setLoading(false))
  }
  useEffect(fetch, []) // eslint-disable-line react-hooks/exhaustive-deps

  const busy = loading || confirming
  return (
    <div className="image-viewer-overlay">
      <div className="image-viewer-topbar">
        <button className="image-viewer-btn" onClick={onClose} disabled={busy}>取消</button>
        <span className="crop-flex" />
        <button className="image-viewer-btn" onClick={fetch} disabled={busy}>
          <Icon name="refresh" size={16} /> 换一张
        </button>
        <button className="image-viewer-btn primary" disabled={busy}
          onClick={() => { if (!url) return; setConfirming(true); onUse(url) }}>
          {confirming ? '设置中…' : '使用这张'}
        </button>
      </div>
      <div className="image-viewer-body">
        {loading ? <span className="spinner" /> : url && <img src={url} alt="随机头像" draggable={false} />}
      </div>
      <div className="crop-hint">不喜欢就换一张，满意点「使用这张」</div>
    </div>
  )
}
