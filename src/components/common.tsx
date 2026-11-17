import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Song, PlaylistSummary } from '../lib/types'
import { sourceLabel, songKey } from '../lib/types'
import { playlistSubtitle, formatPlayCount } from '../lib/utils'
import { api } from '../lib/api'
import { usePlayer, useLibrary } from '../store/useStore'

// ---------------- 图标（内联 SVG，避免额外依赖）----------------

export const Icon = ({ name, size = 22, className = '' }: { name: string; size?: number; className?: string }) => {
  const paths: Record<string, React.ReactNode> = {
    home: <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    library: <><path d="M4 6v14M8 6v14" /><path d="m12 6 4 14M17 6l4 14" /></>,
    back: <path d="M20 12H4m0 0 7-7m-7 7 7 7" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    play: <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />,
    pause: <><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /></>,
    prev: <><path d="M18 5v14L8 12z" fill="currentColor" stroke="none" /><rect x="4" y="5" width="3" height="14" rx="1" fill="currentColor" stroke="none" /></>,
    next: <><path d="M6 5v14l10-7z" fill="currentColor" stroke="none" /><rect x="17" y="5" width="3" height="14" rx="1" fill="currentColor" stroke="none" /></>,
    like: <path d="M12 21s-8-4.8-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 3.5C20 16.2 12 21 12 21z" />,
    liked: <path d="M12 21s-8-4.8-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 3.5C20 16.2 12 21 12 21z" fill="currentColor" stroke="none" />,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 17v3h16v-3" /></>,
    queue: <><path d="M4 6h12M4 12h12M4 18h8" /><circle cx="18" cy="18" r="3" /></>,
    repeat: <path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />,
    repeatOne: <><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" /><text x="10" y="15" fontSize="8" fill="currentColor" stroke="none">1</text></>,
    shuffle: <><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></>,
    volume: <><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" /></>,
    timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M9 2h6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-3v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-2-2 .1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3v-3h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-2 .1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3h3v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 2 2-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21v3h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
    add: <path d="M12 5v14M5 12h14" />,
    check: <path d="m4 12 5 5L20 6" />,
    more: <><circle cx="5" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="19" cy="12" r="1.5" fill="currentColor" /></>,
    delete: <><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    person: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    folder: <path d="M3 7h6l2 2h10v11H3z" />,
    sort: <><path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3" /></>,
    select: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="m8 12 3 3 5-6" /></>,
    filter: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
    refresh: <><path d="M20 11a8 8 0 1 0-2 6" /><path d="M20 4v7h-7" /></>,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.5 10.5 7-4m-7 7 7 4" /></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
    note: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  }
  return (
    <svg
      className={className}
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.note}
    </svg>
  )
}

// ---------------- 顶栏 ----------------
export function TopBar({ title, onBack, actions }: { title: string; onBack?: () => void; actions?: React.ReactNode }) {
  const nav = useNavigate()
  return (
    <div className={`topbar${onBack ? '' : ' no-back'}`}>
      {onBack ? (
        <button className="icon-btn" onClick={onBack} aria-label="返回"><Icon name="back" /></button>
      ) : null}
      <div className="topbar-title">{title}</div>
      <div className="topbar-actions">{actions}</div>
    </div>
  )
}

// ---------------- 封面 ----------------
export function Cover({ url, size, corner = 8, className = '' }: { url?: string | null; size?: number; corner?: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(url || null)
  useEffect(() => { setSrc(url || null) }, [url])
  return (
    <div
      className={`cover ${className}`}
      style={{ width: size, height: size, borderRadius: corner, ...(size ? {} : {}) }}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" onError={() => setSrc(null)} />
      ) : (
        <span className="cover-ph"><Icon name="note" size={(size || 48) * 0.42} /></span>
      )}
    </div>
  )
}

// ---------------- 音源标签 ----------------
export function SourceTag({ source }: { source: string }) {
  return <span className="source-tag">{sourceLabel(source)}</span>
}

// ---------------- 均衡器动画 ----------------
export function PlayingBars({ playing }: { playing: boolean }) {
  return (
    <span className={`playing-bars ${playing ? 'on' : ''}`}>
      <i /><i /><i />
    </span>
  )
}

// ---------------- 收藏按钮 ----------------
export function LikeButton({ song, size = 22 }: { song: Song; size?: number }) {
  const isLiked = useLibrary((s) => s.isLiked(song))
  const toggleLike = useLibrary((s) => s.toggleLike)
  return (
    <button
      className={`icon-btn like-btn ${isLiked ? 'liked' : ''}`}
      onClick={(e) => { e.stopPropagation(); toggleLike(song) }}
      aria-label={isLiked ? '取消喜欢' : '喜欢'}
    >
      <Icon name={isLiked ? 'liked' : 'like'} size={size} />
    </button>
  )
}

// ---------------- 歌曲行 ----------------
export function SongRow({
  song, active, playing, onPlay, onLongClick, trailing, subtitle,
}: {
  song: Song
  active?: boolean
  playing?: boolean
  onPlay?: () => void
  onLongClick?: () => void
  trailing?: React.ReactNode
  subtitle?: string
}) {
  return (
    <div
      className={`song-row ${active ? 'active' : ''}`}
      onClick={onPlay}
      onContextMenu={(e) => { if (onLongClick) { e.preventDefault(); onLongClick() } }}
    >
      <Cover url={song.pic} size={48} />
      <div className="song-info">
        <div className="song-name">{song.name || '未知歌曲'}</div>
        <div className="song-sub">
          <SourceTag source={song.source} />
          <span className="ellipsis">{subtitle || [song.artist, song.album].filter(Boolean).join(' · ')}</span>
        </div>
      </div>
      {playing && <PlayingBars playing />}
      {trailing && <div className="row-trailing" onClick={(e) => e.stopPropagation()}>{trailing}</div>}
    </div>
  )
}

// ---------------- 歌单行 ----------------
export function PlaylistRow({
  playlist, subtitle, onClick, trailing,
}: {
  playlist: PlaylistSummary
  subtitle?: string
  onClick?: () => void
  trailing?: React.ReactNode
}) {
  return (
    <div className="playlist-row" onClick={onClick}>
      <Cover url={playlist.coverUrl} size={52} corner={10} />
      <div className="song-info">
        <div className="song-name clamp2">{playlist.name}</div>
        <div className="song-sub ellipsis">{subtitle ?? playlistSubtitle(playlist)}</div>
      </div>
      {trailing && <div className="row-trailing" onClick={(e) => e.stopPropagation()}>{trailing}</div>}
    </div>
  )
}

// ---------------- 区块标题 ----------------
export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="section-header">
      <span className="section-title">{title}</span>
      {action}
    </div>
  )
}

export function HeaderAction({ text, onClick }: { text: string; onClick: () => void }) {
  return <button className="header-action" onClick={onClick}>{text}<Icon name="chevron" size={14} /></button>
}

// ---------------- 状态块 ----------------
export function LoadingBox() {
  return <div className="state-box"><span className="spinner" /></div>
}
export function EmptyBox({ text }: { text: string }) {
  return <div className="state-box"><p>{text}</p></div>
}
export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-box">
      <p>{message}</p>
      {onRetry && <button className="btn" onClick={onRetry}>重试</button>}
    </div>
  )
}

// ---------------- 弹层 ----------------
export function Sheet({ title, subtitle, onClose, children }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title">{title}</div>
            {subtitle && <div className="sheet-sub">{subtitle}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭"><Icon name="close" /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

// ---------------- 简单确认对话框 ----------------
export function Dialog({ title, content, confirmText = '确定', cancelText = '取消', onConfirm, onClose, danger = false }: {
  title: string; content?: React.ReactNode; confirmText?: string; cancelText?: string
  onConfirm: () => void; onClose: () => void; danger?: boolean
}) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">{title}</div>
        {content && <div className="dialog-content">{content}</div>}
        <div className="dialog-actions">
          <button className="btn-text" onClick={onClose}>{cancelText}</button>
          <button className={`btn ${danger ? 'danger' : ''}`} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  )
}

// ---------------- Toast ----------------
let toastTimer: number | undefined
export function toast(msg: string) {
  let el = document.getElementById('mm2-toast')
  if (!el) {
    el = document.createElement('div')
    el.id = 'mm2-toast'
    el.className = 'toast'
    document.body.appendChild(el)
  }
  el.textContent = msg
  el.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => el?.classList.remove('show'), 2200)
}

// ---------------- 图片查看器（全屏）----------------
export function ImageViewer({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const [scale, setScale] = useState(1)
  return (
    <div className="image-viewer" onClick={onClose}>
      <div className="image-viewer-bar">
        <span className="ellipsis">{title}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost-light" onClick={(e) => { e.stopPropagation(); setScale((s) => Math.min(5, s * 1.5)) }}>放大</button>
          <button className="btn-ghost-light" onClick={(e) => { e.stopPropagation(); setScale(1) }}>复位</button>
          <button className="btn-ghost-light" onClick={onClose}>关闭</button>
        </div>
      </div>
      <img src={url} alt={title} style={{ transform: `scale(${scale})` }} onClick={(e) => e.stopPropagation()} />
    </div>
  )
}

/** 播放整张列表的通用助手 */
export function playList(songs: Song[], index: number) {
  const p = usePlayer.getState()
  p.playAll(songs, index)
}
