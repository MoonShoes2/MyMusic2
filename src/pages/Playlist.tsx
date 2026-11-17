import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Song, PlaylistSummary } from '../lib/types'
import { sourceLabel } from '../lib/types'
import { usePlayer, useLibrary } from '../store/useStore'
import { TopBar, Cover, SongRow, LikeButton, LoadingBox, EmptyBox, ErrorBox, toast, Icon } from '../components/common'

export default function PlaylistPage() {
  const { source = '', id = '' } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const name = params.get('name') || '歌单'
  const cover = params.get('cover') || ''
  const [songs, setSongs] = useState<Song[] | null>(null)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const [collecting, setCollecting] = useState(false)
  const playlists = useLibrary((s) => s.playlists)
  const createPlaylist = useLibrary((s) => s.createPlaylist)
  const addToPlaylist = useLibrary((s) => s.addToPlaylist)

  useEffect(() => {
    let alive = true
    setSongs(null); setError('')
    api.playlistSongs(source, id)
      .then((r) => alive && setSongs(r))
      .catch((e) => alive && setError(e?.message || '歌单加载失败'))
    return () => { alive = false }
  }, [source, id, tick])

  // 原版语义：同名自建歌单存在 = 已收藏（按钮显示"已收藏"，再点取消 = 删除同名歌单）
  const collected = playlists.some((p) => p.name === name)
  const playingKey = usePlayer((s) => {
    const song = s.queue[s.currentIndex]
    return song ? `${song.source}_${song.id}` : ''
  })

  // 对齐原版 PlaylistCollector：已收藏 → 合并去重；未收藏 → 创建同名歌单
  const toggleCollect = useCallback(() => {
    if (collecting) return
    const list = songs || []
    if (collected) {
      const target = playlists.find((p) => p.name === name)
      if (!target) return
      setCollecting(true)
      useLibrary.getState().deletePlaylist(target.id)
      setCollecting(false)
      toast(`已取消收藏，歌单《${name}》已删除`)
      return
    }
    if (list.length === 0) { toast('这张歌单里没有歌曲'); return }
    setCollecting(true)
    try {
      const existing = playlists.find((p) => p.name === name)
      if (existing) {
        const added = useLibrary.getState().addToPlaylist(existing.id, list)
        if (added === 0) toast(`《${existing.name}》里已有全部 ${existing.songs.length} 首`)
        else toast(`已加入《${existing.name}》 ${added} 首（跳过 ${list.length - added} 首重复）`)
      } else {
        const pl = createPlaylist(name)
        useLibrary.getState().addToPlaylist(pl.id, list)
        toast(`已创建歌单《${name}》，收藏 ${list.length} 首`)
      }
    } catch {
      toast('收藏失败，请重试')
    } finally {
      setCollecting(false)
    }
  }, [collecting, collected, songs, playlists, name, createPlaylist])

  return (
    <div className="page">
      <TopBar title={name} onBack={() => nav(-1)} />
      <div className="scroll-area">
        <div className="playlist-header">
          <div className="cover-large small" onClick={() => cover && window.dispatchEvent(new CustomEvent('mm2-image', { detail: { url: cover, title: name } }))}>
            <Cover url={cover} size={96} corner={12} />
          </div>
          <div className="playlist-meta">
            <div className="playlist-name clamp2">{name}</div>
            <div className="playlist-desc">{sourceLabel(source)} · 共 {songs?.length ?? 0} 首</div>
            <div className="playlist-actions">
              <button className="btn play-all-btn" disabled={!songs?.length}
                onClick={() => { if (songs) { usePlayer.getState().playAll(songs, 0); nav('/player') } }}>
                <Icon name="play" size={18} /> 播放全部
              </button>
              {/* 收藏歌单：紧挨「播放全部」（对齐原 App PlaylistHeader），未收藏=描边按钮，已收藏=主色高亮 */}
              <button className={`btn collect-btn ${collected ? 'collected' : ''}`} disabled={collecting}
                onClick={toggleCollect} aria-label={collected ? '已收藏，点击取消' : '收藏歌单'}>
                <Icon name={collected ? 'check' : 'folder'} size={18} /> {collected ? '已收藏' : '收藏'}
              </button>
            </div>
          </div>
        </div>
        {songs === null ? <LoadingBox /> : error ? <ErrorBox message={error} onRetry={() => setTick((t) => t + 1)} />
          : songs.length === 0 ? <EmptyBox text="歌单暂无歌曲" /> : (
            <div className="song-list">
              {songs.map((song, i) => (
                <SongRow key={`${song.source}_${song.id}_${i}`} song={song}
                  active={playingKey === `${song.source}_${song.id}`}
                  trailing={<LikeButton song={song} />}
                  onPlay={() => { usePlayer.getState().playAll(songs, i); nav('/player') }} />
              ))}
            </div>
          )}
      </div>
    </div>
  )
}
