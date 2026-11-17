import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { formatMs } from '../lib/utils'
import { usePlayer } from '../store/useStore'
import { Icon, Cover, LikeButton, PlayingBars, Sheet, SongRow, toast } from './common'

export function QueueSheet({ onClose }: { onClose: () => void }) {
  const queue = usePlayer((s) => s.queue)
  const index = usePlayer((s) => s.currentIndex)
  const isPlaying = usePlayer((s) => s.isPlaying)
  const playAt = usePlayer((s) => s.playAt)
  const removeAt = usePlayer((s) => s.removeAt)
  const playNext = usePlayer((s) => s.playNext)

  return (
    <Sheet title="播放队列" subtitle={`共 ${queue.length} 首`} onClose={onClose}>
      {queue.length === 0 ? (
        <div className="state-box"><p>队列为空</p></div>
      ) : (
        <div className="queue-list">
          {queue.map((song, i) => (
            <div key={`${song.source}_${song.id}_${i}`} className={`queue-row ${i === index ? 'active' : ''}`}>
              <div className="queue-row-main" onClick={() => i !== index && playAt(i)}>
                <Cover url={song.pic} size={40} />
                <div className="song-info">
                  <div className={`song-name ${i === index ? 'active' : ''}`}>{song.name}</div>
                  <div className="song-sub">
                    {i === index ? (
                      <><PlayingBars playing={isPlaying} /><span style={{ marginLeft: 6 }}>正在播放</span></>
                    ) : <span className="ellipsis">{song.artist}</span>}
                  </div>
                </div>
              </div>
              {i !== index && (
                <div className="queue-row-actions">
                  <button className="btn-text" onClick={() => playNext(song)}>下一首</button>
                  <button className="icon-btn small" onClick={() => removeAt(i)} aria-label="移除"><Icon name="close" size={18} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}

export function MiniPlayer() {
  const navigate = useNavigate()
  const queue = usePlayer((s) => s.queue)
  const index = usePlayer((s) => s.currentIndex)
  const isPlaying = usePlayer((s) => s.isPlaying)
  const isLoading = usePlayer((s) => s.isLoading)
  const position = usePlayer((s) => s.positionMs)
  const duration = usePlayer((s) => s.durationMs)
  const toggle = usePlayer((s) => s.toggle)
  const next = usePlayer((s) => s.next)
  const prev = usePlayer((s) => s.prev)
  const stop = usePlayer((s) => s.stop)
  const [showQueue, setShowQueue] = useState(false)

  const song = queue[index]
  if (!song) return null
  const progress = duration > 0 ? Math.min(1, position / duration) : 0

  return (
    <>
      <div className="mini-player" onClick={() => navigate('/player')}>
        <div className="mini-progress" style={{ width: `${progress * 100}%` }} />
        <div className="mini-cover">
          <Cover url={song.pic} size={40} />
        </div>
        <div className="song-info mini-info">
          <div className="song-name">{song.name}</div>
          <div className="song-sub">{song.artist}</div>
        </div>
        <PlayingBars playing={isPlaying} />
        <div className="mini-actions">
          <LikeButton song={song} size={20} />
          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); toggle() }} aria-label={isPlaying ? '暂停' : '播放'}>
            {isLoading ? <span className="spinner small" /> : <Icon name={isPlaying ? 'pause' : 'play'} size={22} />}
          </button>
          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setShowQueue(true) }} aria-label="播放队列"><Icon name="queue" size={20} /></button>
          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); stop() }} aria-label="关闭"><Icon name="close" size={20} /></button>
        </div>
      </div>
      {showQueue && <QueueSheet onClose={() => setShowQueue(false)} />}
    </>
  )
}
