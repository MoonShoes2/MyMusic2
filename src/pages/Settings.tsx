import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useSettings, useLibrary } from '../store/useStore'
import { TopBar, Dialog, toast, Icon, ImageViewer } from '../components/common'

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
  const [showAvatar, setShowAvatar] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  return (
    <div className="page">
      <TopBar title="设置" onBack={() => nav(-1)} />
      <div className="scroll-area">
        <div className="settings-group">
          <div className="settings-row" onClick={() => setShowAvatar(true)}>
            <div className="settings-row-text">
              <div className="settings-title">头像</div>
              <div className="settings-sub">使用随机头像或输入图片链接</div>
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
      {showAvatar && (
        <SheetAvatar onClose={() => setShowAvatar(false)}
          onPick={(url) => { setAvatar(url); setShowAvatar(false); toast('头像已更新') }}
          onPreview={(url) => setAvatarUrl(url)} />
      )}
      {avatarUrl && <ImageViewer url={avatarUrl} title="头像预览" onClose={() => setAvatarUrl(null)} />}
    </div>
  )
}

function SheetAvatar({ onClose, onPick, onPreview }: { onClose: () => void; onPick: (url: string) => void; onPreview: (url: string) => void }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">设置头像</div>
        <div className="dialog-content">
          <input className="dialog-input" placeholder="粘贴图片链接" value={url} onChange={(e) => setUrl(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn-outline" disabled={loading} onClick={async () => {
              setLoading(true)
              try { const r = await api.randomAvatar(); setUrl(r); onPreview(r) } catch { toast('获取随机头像失败') } finally { setLoading(false) }
            }}>{loading ? '获取中…' : '随机头像'}</button>
            {url && <button className="btn-outline" onClick={() => onPreview(url)}>预览</button>}
          </div>
        </div>
        <div className="dialog-actions">
          <button className="btn-text" onClick={onClose}>取消</button>
          <button className="btn" disabled={!url} onClick={() => onPick(url)}>使用这张</button>
        </div>
      </div>
    </div>
  )
}
