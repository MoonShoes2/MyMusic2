import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { PlaylistSummary, Song, Source } from '../lib/types'
import { sourceLabel } from '../lib/types'
import { playlistSubtitle } from '../lib/utils'
import { usePlayer, useLibrary } from '../store/useStore'
import { Cover, SectionHeader, HeaderAction, LoadingBox, EmptyBox, SongRow, toast } from '../components/common'

const SOURCES: Source[] = ['wy', 'qq', 'kg']

/** 下拉刷新触发阈值（px）：超过后松手才真正刷新，对齐 Material 3 手感 */
const PULL_THRESHOLD = 72
/** 指示器最大位移：下拉距离的阻尼系数之后的上限 */
const PULL_MAX = 64

export default function Home() {
  const nav = useNavigate()
  const [recommends, setRecommends] = useState<PlaylistSummary[] | null>(null)
  const [toplists, setToplists] = useState<PlaylistSummary[] | null>(null)
  const [songs, setSongs] = useState<Song[] | null>(null)
  const [source, setSource] = useState<Source>('wy')
  const [refreshTick, setRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let alive = true
    setRecommends(null); setToplists(null); setSongs(null)
    setRefreshing(true)
    const p1 = api.recommend().then((r) => alive && setRecommends(r)).catch(() => alive && setRecommends([]))
    const p2 = api.newsongs().then((r) => alive && setSongs(r)).catch(() => alive && setSongs([]))
    const p3 = api.toplists(source).then((r) => alive && setToplists(r.slice(0, 5))).catch(() => alive && setToplists([]))
    Promise.all([p1, p2, p3]).finally(() => alive && setRefreshing(false))
    return () => { alive = false }
  }, [source, refreshTick])

  const openPlaylist = useCallback((p: PlaylistSummary) => {
    nav(`/playlist/${p.source}/${encodeURIComponent(p.id)}?name=${encodeURIComponent(p.name)}&cover=${encodeURIComponent(p.coverUrl || '')}`)
  }, [nav])

  const playingKey = usePlayer((s) => {
    const song = s.queue[s.currentIndex]
    return song ? `${song.source}_${song.id}` : ''
  })

  // ---------- 下拉刷新（对齐原 App Material3 PullToRefresh） ----------
  const scrollRef = useRef<HTMLDivElement>(null)
  const [pull, setPull] = useState(0)
  const touch = useRef({ startY: 0, pulling: false })
  const refreshTickRef = refreshTick

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onStart = (e: TouchEvent) => {
      if (el.scrollTop <= 0 && !refreshing) {
        touch.current = { startY: e.touches[0].clientY, pulling: true }
      }
    }
    const onMove = (e: TouchEvent) => {
      if (!touch.current.pulling) return
      const dy = e.touches[0].clientY - touch.current.startY
      if (dy > 0 && el.scrollTop <= 0) {
        // 阻尼：越拉越沉，超过上限不再跟手
        setPull(Math.min(dy * 0.45, PULL_MAX))
        if (e.cancelable) e.preventDefault()
      } else if (dy < 0) {
        setPull(0)
      }
    }
    const onEnd = () => {
      if (!touch.current.pulling) return
      touch.current.pulling = false
      if (pull >= PULL_THRESHOLD || pull >= PULL_MAX * 0.85) {
        setRefreshKey((k) => k + 1)
      }
      setPull(0)
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [refreshing, pull, refreshTickRef])

  if (recommends === null && toplists === null && songs === null) return <div className="page"><LoadingBox /></div>

  const empty = (recommends?.length || 0) + (toplists?.length || 0) + (songs?.length || 0) === 0

  // 指示器位移：下拉时跟手；刷新中固定停在展开位置
  const indicatorY = refreshing ? PULL_MAX - 8 : Math.max(0, pull - 8)

  return (
    <div className="page home-page">
      <div className="topbar no-back"><div className="topbar-title">发现音乐</div></div>

      {empty ? <EmptyBox text="暂时没有内容" /> : (
        <div className="home-pull-wrap">
          {/* Material 下拉刷新指示器：顶部居中圆盘，随手指位移 / 刷新中旋转 */}
          <div className="ptr-indicator" style={{ transform: `translate(-50%, ${indicatorY}px)`, opacity: pull > 0 || refreshing ? 1 : 0 }}>
            <span className="spinner" />
          </div>
          <div className="scroll-area" ref={scrollRef}>
            {/* 为你推荐 */}
            <SectionHeader title="为你推荐" action={<HeaderAction text="更多" onClick={() => nav('/recommend')} />} />
            {recommends && (
              <div className="reco-grid">
                {recommends.slice(0, 3).map((p) => (
                  <div key={`${p.source}_${p.id}`} className="reco-card" onClick={() => openPlaylist(p)}>
                    <div className="reco-cover">
                      <Cover url={p.coverUrl} corner={12} className="aspect-cover" />
                    </div>
                    <div className="reco-name clamp2">{p.name}</div>
                  </div>
                ))}
              </div>
            )}

            {/* 榜单 */}
            <SectionHeader title="榜单" action={<HeaderAction text="查看全部" onClick={() => nav(`/toplists/${source}`)} />} />
            <div className="segmented">
              {SOURCES.map((s) => (
                <button key={s} className={s === source ? 'active' : ''} onClick={() => setSource(s)}>{sourceLabel(s)}</button>
              ))}
            </div>
            <div className="toplist-wrap">
              {toplists === null ? <LoadingBox /> : toplists.length === 0 ? <EmptyBox text="该音源暂无榜单" /> : (
                toplists.map((p) => (
                  <div key={`${p.source}_${p.id}`} className="list-row" onClick={() => openPlaylist(p)}>
                    <Cover url={p.coverUrl} size={52} corner={10} />
                    <div className="song-info">
                      <div className="song-name clamp2">{p.name}</div>
                      <div className="song-sub ellipsis">{playlistSubtitle(p)}</div>
                    </div>
                    <span className="chevron"><IconChevron /></span>
                  </div>
                ))
              )}
            </div>

            {/* 新歌速递 */}
            <SectionHeader title="新歌速递" action={<HeaderAction text="更多" onClick={() => nav('/newsongs')} />} />
            {songs === null ? <LoadingBox /> : songs.length === 0 ? <EmptyBox text="暂无新歌" /> : (
              <div className="song-list">
                {songs.slice(0, 5).map((song, i) => (
                  <SongRow key={songKeyOf(song)} song={song}
                    active={playingKey === songKeyOf(song)}
                    onPlay={() => { usePlayer.getState().playAll(songs!, i); nav('/player') }} />
                ))}
              </div>
            )}
            <div style={{ height: 16 }} />
          </div>
        </div>
      )}
    </div>
  )
}

function songKeyOf(s: Song) { return `${s.source}_${s.id}` }

function IconChevron() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m9 5 7 7-7 7" /></svg>
}
