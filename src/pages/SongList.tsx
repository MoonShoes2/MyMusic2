import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Song } from '../lib/types'
import { usePlayer, useLibrary } from '../store/useStore'
import { TopBar, SongRow, LikeButton, EmptyBox, toast, Dialog, Icon } from '../components/common'
import { getDownloadList, deleteDownload } from './DownloadSection'

type ListType = 'liked' | 'downloaded' | 'recent'

const titles: Record<ListType, { title: string; empty: string }> = {
  liked: { title: '我的收藏', empty: '还没有收藏的歌曲' },
  downloaded: { title: '已下载', empty: '还没有下载的歌曲' },
  recent: { title: '最近播放', empty: '还没有播放记录' },
}

export default function SongList() {
  const { type = 'liked' } = useParams()
  const t = type as ListType
  const nav = useNavigate()
  const [filter, setFilter] = useState('')
  const [downloaded, setDownloaded] = useState<Song[]>([])
  const likedSongs = useLibrary((s) => s.likedSongs)
  const recentSongs = useLibrary((s) => s.recentSongs)
  const removeRecent = useLibrary((s) => s.removeRecent)
  const toggleLike = useLibrary((s) => s.toggleLike)
  const playingKey = usePlayer((s) => {
    const song = s.queue[s.currentIndex]
    return song ? `${song.source}_${song.id}` : ''
  })

  useEffect(() => {
    if (t !== 'downloaded') return
    let alive = true
    getDownloadList().then((list) => alive && setDownloaded(list.map((x) => x.song)))
    return () => { alive = false }
  }, [t])

  const base = t === 'liked' ? likedSongs : t === 'recent' ? recentSongs : downloaded
  const list = useMemo(() => {
    if (!filter.trim()) return base
    const k = filter.trim().toLowerCase()
    return base.filter((s) => s.name.toLowerCase().includes(k) || s.artist.toLowerCase().includes(k))
  }, [base, filter])

  const play = (i: number) => { usePlayer.getState().playAll(list, i); nav('/player') }

  return (
    <div className="page">
      <TopBar title={titles[t]?.title || '歌曲列表'} onBack={() => nav(-1)} />
      <div className="songlist-page">
        {(t === 'liked' || t === 'downloaded') && list.length > 0 && (
          <div className="filter-box">
            <Icon name="filter" size={18} />
            <input placeholder="过滤歌名或歌手" value={filter} onChange={(e) => setFilter(e.target.value)} />
            {filter && <button className="icon-btn small" onClick={() => setFilter('')}><Icon name="close" size={16} /></button>}
          </div>
        )}
        <div className="scroll-area">
          {list.length === 0 ? (
            <EmptyBox text={filter ? `没有匹配「${filter}」的歌曲` : titles[t]?.empty || '暂无歌曲'} />
          ) : (
            <div className="song-list">
              {list.map((song, i) => (
                <SongRow key={`${song.source}_${song.id}_${i}`} song={song}
                  active={playingKey === `${song.source}_${song.id}`}
                  trailing={
                    t === 'liked' ? <LikeButton song={song} /> :
                    t === 'recent' ? (
                      <button className="icon-btn small" onClick={() => { removeRecent(song); toast('已从最近播放中移除') }} aria-label="移除"><Icon name="close" size={18} /></button>
                    ) : (
                      <button className="icon-btn small" onClick={() => {
                        deleteDownload(`${song.source}_${song.id}`).then(() => {
                          setDownloaded((d) => d.filter((x) => `${x.source}_${x.id}` !== `${song.source}_${song.id}`))
                          toast('已删除下载')
                        })
                      }} aria-label="删除下载"><Icon name="delete" size={18} /></button>
                    )
                  }
                  onPlay={() => play(i)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
