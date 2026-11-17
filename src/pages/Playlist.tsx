import { useEffect, useState } from 'react'
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
  const playlists = useLibrary((s) => s.playlists)
  const createPlaylist = useLibrary((s) => s.createPlaylist)
  const addToPlaylist = useLibrary((s) => s.addToPlaylist)

  useEffect(() => {
    let alive = true
    setSongs(null); setError('')
    api.playlistSongs(source, id).then((r) => alive && setSongs(r)).catch((e) => alive && setError(e?.message || '歌单加载失败'))
    return () => { alive = false }
  }, [source, id])

  const collected = playlists.some((p) => p.name === name)
  const playingKey = usePlayer((s) => {
    const song = s.queue[s.currentIndex]
    return song ? `${song.source}_${song.id}` : ''
  })

  const toggleCollect = () => {
    if (collected) {
      const target = playlists.find((p) => p.name === name)
      if (target) useLibrary.getState().deletePlaylist(target.id)
      toast(`已取消收藏，歌单《${name}》已删除`)
    } else {
      const list = songs || []
      const pl = createPlaylist(name)
      addToPlaylist(pl.id, list)
      toast(`已创建歌单《${name}》，收藏 ${list.length} 首`)
    }
  }

  return (
    <div className="page">
      <TopBar title={name} onBack={() => nav(-1)} actions={
        <button className="icon-btn" onClick={toggleCollect} aria-label={collected ? '已收藏' : '收藏歌单'}>
          <Icon name={collected ? 'check' : 'folder'} size={22} />
        </button>
      } />
      <div className="scroll-area">
        <div className="playlist-header">
          <div className="cover-large small" onClick={() => cover && window.dispatchEvent(new CustomEvent('mm2-image', { detail: { url: cover, title: name } }))}>
            <Cover url={cover} size={96} corner={12} />
          </div>
          <div className="playlist-meta">
            <div className="playlist-name clamp2">{name}</div>
            <div className="playlist-desc">{sourceLabel(source)} · 共 {songs?.length ?? 0} 首</div>
            <button className="btn play-all-btn" disabled={!songs?.length}
              onClick={() => { if (songs) { usePlayer.getState().playAll(songs, 0); nav('/player') } }}>
              <Icon name="play" size={18} /> 播放全部
            </button>
          </div>
        </div>
        {songs === null ? <LoadingBox /> : error ? <ErrorBox message={error} onRetry={() => window.location.reload()} />
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
