import { useEffect, useRef, useState } from 'react'
import { audioEngine } from '../lib/audioEngine'
import { api } from '../lib/api'
import { formatMs, parseLrc, findLyricIndex, type LyricLine } from '../lib/utils'
import { usePlayer, useSettings } from '../store/useStore'
import { Icon, Cover, LikeButton, PlayingBars, TopBar, Sheet, toast } from '../components/common'
import { QueueSheet } from '../components/MiniPlayer'
import { DownloadSection } from './DownloadSection'

export default function PlayerPage() {
  const queue = usePlayer((s) => s.queue)
  const index = usePlayer((s) => s.currentIndex)
  const isPlaying = usePlayer((s) => s.isPlaying)
  const isLoading = usePlayer((s) => s.isLoading)
  const position = usePlayer((s) => s.positionMs)
  const duration = usePlayer((s) => s.durationMs)
  const volume = usePlayer((s) => s.volume)
  const mode = usePlayer((s) => s.mode)
  const sleepEndAt = usePlayer((s) => s.sleepEndAt)
  const pauseAfterCurrent = usePlayer((s) => s.pauseAfterCurrent)
  const toggle = usePlayer((s) => s.toggle)
  const next = usePlayer((s) => s.next)
  const prev = usePlayer((s) => s.prev)
  const cycleMode = usePlayer((s) => s.cycleMode)
  const setVolume = usePlayer((s) => s.setVolume)
  const setSleepTimer = usePlayer((s) => s.setSleepTimer)
  const setError = usePlayer((s) => s.setError)
  const error = usePlayer((s) => s.error)

  const [page, setPage] = useState(0)
  const [showQueue, setShowQueue] = useState(false)
  const [showSleep, setShowSleep] = useState(false)
  const [showVolume, setShowVolume] = useState(false)
  const [showDownload, setShowDownload] = useState(false)
  const [lrcLines, setLrcLines] = useState<LyricLine[] | null>(null)
  const lyricRef = useRef<HTMLDivElement>(null)
  const offset = useSettings((s) => s.lyricOffset)

  const song = queue[index]

  // 消费全局错误
  useEffect(() => {
    if (error) {
      toast(error)
      setError(null)
    }
  }, [error, setError])

  // 加载歌词
  useEffect(() => {
    if (!song) { setLrcLines(null); return }
    let alive = true
    setLrcLines(null)
    api.lrc(song).then((lrc) => {
      if (!alive) return
      setLrcLines(parseLrc(lrc))
    }).catch(() => alive && setLrcLines([]))
    return () => { alive = false }
  }, [song?.id, song?.source])

  const currentLine = findLyricIndex(lrcLines || [], position + offset)
  useEffect(() => {
    if (page !== 1 || !lyricRef.current || currentLine < 0) return
    const el = lyricRef.current.querySelector(`[data-line="${currentLine}"]`) as HTMLElement | null
    if (el) lyricRef.current.scrollTo({ top: el.offsetTop - lyricRef.current.clientHeight / 3, behavior: 'smooth' })
  }, [currentLine, page])

  if (!song) {
    return (
      <div className="page">
        <TopBar title="播放" onBack={() => history.back()} />
        <div className="state-box"><p>暂无播放内容</p></div>
      </div>
    )
  }

  const modeIcon = mode === 'single' ? 'repeatOne' : mode === 'shuffle' ? 'shuffle' : 'repeat'
  const modeLabel = mode === 'single' ? '单曲循环' : mode === 'shuffle' ? '随机播放' : '列表循环'
  const sleepLabel = pauseAfterCurrent ? '播完当前歌曲后停止'
    : sleepEndAt ? `剩余 ${formatMs(Math.max(0, sleepEndAt - Date.now()))}` : '睡眠定时'

  return (
    <div className="player-page">
      {/* 顶栏：居中显示歌名 + 歌手（对齐原生 PlayerTopBar） */}
      <div className="topbar player-topbar">
        <button className="icon-btn" onClick={() => history.back()} aria-label="关闭"><Icon name="close" /></button>
        <div className="player-topbar-center">
          <div className="player-song-name tiny">{song.name}</div>
          <div className="player-song-artist tiny">{song.artist || '未知歌手'}</div>
        </div>
        <div style={{ width: 40 }} />
      </div>

      {/* 翻页指示点 */}
      <div className="pager-dots">
        <span className={page === 0 ? 'on' : ''} onClick={() => setPage(0)} />
        <span className={page === 1 ? 'on' : ''} onClick={() => setPage(1)} />
      </div>

      {/* 封面 / 歌词 左右滑动切换 */}
      <div className="pager" onTouchStart={(e) => { (e.currentTarget as any)._x = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          const start = (e.currentTarget as any)._x
          if (start == null) return
          const dx = e.changedTouches[0].clientX - start
          if (Math.abs(dx) > 60) setPage((p) => Math.max(0, Math.min(1, p + (dx < 0 ? 1 : -1))))
        }}>
        <div className="pager-track" style={{ transform: `translateX(-${page * 50}%)` }}>
          {/* 封面页 */}
          <div className="pager-panel cover-panel">
            <div className="cover-large" onClick={() => window.dispatchEvent(new CustomEvent('mm2-image', { detail: { url: song.pic || '', title: song.name } }))}>
              <Cover url={song.pic} corner={16} className="aspect-cover" />
            </div>
            <div className="player-song-meta">
              <div className="player-song-name">{song.name}</div>
              <div className="player-song-artist">{song.artist || '未知歌手'}{song.album ? ` · ${song.album}` : ''}</div>
            </div>
          </div>
          {/* 歌词页 */}
          <div className="pager-panel lyric-panel">
            {lrcLines === null ? <span className="spinner" /> : lrcLines.length === 0 ? (
              <div className="state-box"><p>暂无歌词</p></div>
            ) : (
              <div className="lyric-scroll" ref={lyricRef}>
                <div style={{ padding: '24vh 0' }} />
                {lrcLines.map((line, i) => (
                  <div key={i} data-line={i}
                    className={`lyric-line ${i === currentLine ? 'active' : ''}`}
                    onClick={() => audioEngine.seek(line.timeMs)}>
                    {line.text || '♪'}
                  </div>
                ))}
                <div style={{ padding: '24vh 0' }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 功能行 */}
      <div className={`player-functions ${page > 0 ? 'collapsed' : ''}`}>
        <div className="action-row">
          <LikeButton song={song} size={24} />
          <button className="icon-btn" onClick={() => setShowDownload(true)} aria-label="下载"><Icon name="download" size={22} /></button>
          <div className="bubble-anchor">
            <button className="icon-btn" onClick={() => setShowSleep((v) => !v)} aria-label="睡眠定时"><Icon name="timer" size={22} /></button>
            {showSleep && (
              <div className="popover">
                <div className="popover-title">{sleepLabel}</div>
                {[15, 30, 60, 90].map((m) => (
                  <button key={m} className="popover-item" onClick={() => { setSleepTimer(m); setShowSleep(false); toast(`${m} 分钟后停止`) }}>{m} 分钟后停止</button>
                ))}
                <button className="popover-item" onClick={() => { setSleepTimer(0, true); setShowSleep(false); toast('播完当前歌曲后停止') }}>播完当前歌曲后停止</button>
                <button className="popover-item" onClick={() => { setSleepTimer(null); setShowSleep(false); toast('已关闭定时') }}>不定时</button>
              </div>
            )}
          </div>
          <div className="bubble-anchor">
            <button className="icon-btn" onClick={() => setShowVolume((v) => !v)} aria-label="音量"><Icon name="volume" size={22} /></button>
            {showVolume && (
              <div className="popover volume-pop">
                <div className="popover-title">音量 {Math.round(volume * 100)}%</div>
                <input type="range" min="0" max="1" step="0.01" value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))} />
              </div>
            )}
          </div>
        </div>

        {/* 进度条 */}
        <div className="progress-section">
          <input type="range" className="progress-slider" min="0" max={Math.max(1, duration)} step="1"
            value={Math.min(position, duration)} onChange={(e) => audioEngine.seek(Number(e.target.value))}
            style={{ background: `linear-gradient(to right, var(--primary) ${duration ? (position / duration) * 100 : 0}%, var(--track) ${duration ? (position / duration) * 100 : 0}%)` }} />
          <div className="time-row">
            <span>{formatMs(position)}</span>
            <span>{formatMs(duration)}</span>
          </div>
        </div>
      </div>

      {/* 主控制区 */}
      <div className="control-row">
        <button className="icon-btn" onClick={cycleMode} aria-label={modeLabel} title={modeLabel}>
          <Icon name={modeIcon} size={24} />
        </button>
        <button className="icon-btn large" onClick={prev} aria-label="上一首"><Icon name="prev" size={36} /></button>
        <button className="play-fab" onClick={toggle} aria-label={isPlaying ? '暂停' : '播放'}>
          {isLoading ? <span className="spinner" /> : <Icon name={isPlaying ? 'pause' : 'play'} size={30} />}
        </button>
        <button className="icon-btn large" onClick={() => next()} aria-label="下一首"><Icon name="next" size={36} /></button>
        <button className="icon-btn" onClick={() => setShowQueue(true)} aria-label="播放队列"><Icon name="queue" size={24} /></button>
      </div>

      {showQueue && <QueueSheet onClose={() => setShowQueue(false)} />}
      {showDownload && <DownloadSection song={song} onClose={() => setShowDownload(false)} />}
    </div>
  )
}
