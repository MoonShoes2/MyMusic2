import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Song, PlaylistSummary } from '../lib/types'
import { sourceLabel } from '../lib/types'
import { playlistSubtitle } from '../lib/utils'
import { usePlayer, useLibrary } from '../store/useStore'
import { TopBar, PlaylistRow, SongRow, Cover, LoadingBox, EmptyBox, toast, Icon } from '../components/common'

export function TopLists() {
  const { source = 'wy' } = useParams()
  const nav = useNavigate()
  const [lists, setLists] = useState<PlaylistSummary[] | null>(null)
  const playlists = useLibrary((s) => s.playlists)
  const createPlaylist = useLibrary((s) => s.createPlaylist)
  const addToPlaylist = useLibrary((s) => s.addToPlaylist)

  useEffect(() => {
    let alive = true
    setLists(null)
    api.toplists(source as any).then((r) => alive && setLists(r)).catch(() => alive && setLists([]))
    return () => { alive = false }
  }, [source])

  const collect = async (p: PlaylistSummary) => {
    try {
      const songs = await api.playlistSongs(p.source, p.id)
      const pl = createPlaylist(p.name)
      addToPlaylist(pl.id, songs)
      toast(`已创建歌单《${p.name}》，收藏 ${songs.length} 首`)
    } catch { toast('收藏失败，请检查网络后重试') }
  }

  return (
    <div className="page">
      <TopBar title={`${sourceLabel(source)} · 排行榜`} onBack={() => nav(-1)} />
      <div className="scroll-area">
        {lists === null ? <LoadingBox /> : lists.length === 0 ? <EmptyBox text="该音源暂无榜单" /> : (
          lists.map((p) => (
            <PlaylistRow key={`${p.source}_${p.id}`} playlist={p}
              subtitle={playlistSubtitle(p, false, true)}
              onClick={() => nav(`/playlist/${p.source}/${encodeURIComponent(p.id)}?name=${encodeURIComponent(p.name)}&cover=${encodeURIComponent(p.coverUrl || '')}`)}
              trailing={
                <button className="icon-btn small" onClick={() => collect(p)} aria-label="收藏歌单">
                  <Icon name={playlists.some((x) => x.name === p.name) ? 'check' : 'folder'} size={20} />
                </button>
              } />
          ))
        )}
      </div>
    </div>
  )
}

export function NewSongs() {
  const nav = useNavigate()
  const [songs, setSongs] = useState<Song[] | null>(null)
  const playingKey = usePlayer((s) => {
    const song = s.queue[s.currentIndex]
    return song ? `${song.source}_${song.id}` : ''
  })
  useEffect(() => {
    let alive = true
    api.newsongs().then((r) => alive && setSongs(r)).catch(() => alive && setSongs([]))
    return () => { alive = false }
  }, [])
  return (
    <div className="page">
      <TopBar title="新歌速递" onBack={() => nav(-1)} />
      <div className="scroll-area">
        {songs === null ? <LoadingBox /> : songs.length === 0 ? <EmptyBox text="暂无新歌" /> : (
          <div className="song-list">
            {songs.map((song, i) => (
              <SongRow key={`${song.source}_${song.id}_${i}`} song={song}
                active={playingKey === `${song.source}_${song.id}`}
                onPlay={() => { usePlayer.getState().playAll(songs, i); nav('/player') }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function Recommend() {
  const nav = useNavigate()
  const [lists, setLists] = useState<PlaylistSummary[] | null>(null)
  useEffect(() => {
    let alive = true
    api.recommend().then((r) => alive && setLists(r)).catch(() => alive && setLists([]))
    return () => { alive = false }
  }, [])
  return (
    <div className="page">
      <TopBar title="推荐歌单" onBack={() => nav(-1)} />
      <div className="scroll-area">
        {lists === null ? <LoadingBox /> : lists.length === 0 ? <EmptyBox text="暂无推荐歌单" /> : (
          <div className="reco-grid multi">
            {lists.map((p) => (
              <div key={`${p.source}_${p.id}`} className="reco-card"
                onClick={() => nav(`/playlist/${p.source}/${encodeURIComponent(p.id)}?name=${encodeURIComponent(p.name)}&cover=${encodeURIComponent(p.coverUrl || '')}`)}>
                <Cover url={p.coverUrl} corner={10} className="aspect-cover" />
                <div className="reco-name clamp2">{p.name}</div>
                <div className="reco-sub ellipsis">{playlistSubtitle(p)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
