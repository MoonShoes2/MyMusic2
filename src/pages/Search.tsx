import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { Song, Source } from '../lib/types'
import { usePlayer, useLibrary } from '../store/useStore'
import { SongRow, LikeButton, LoadingBox, EmptyBox, toast, Icon } from '../components/common'

const SOURCES: Source[] = ['wy', 'qq', 'kg']

export default function Search() {
  const nav = useNavigate()
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<Source>('wy')
  const [results, setResults] = useState<Song[] | null>(null)
  const [hotwords, setHotwords] = useState<string[] | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const inputRef = useRef<HTMLInputElement>(null)
  const history = useLibrary((s) => s.history)
  const addHistory = useLibrary((s) => s.addHistory)
  const deleteHistory = useLibrary((s) => s.deleteHistory)
  const clearHistory = useLibrary((s) => s.clearHistory)

  const playingKey = usePlayer((s) => {
    const song = s.queue[s.currentIndex]
    return song ? `${song.source}_${song.id}` : ''
  })

  useEffect(() => {
    setHotwords(null)
    api.hotwords(source)
      .then((w) => setHotwords(w.length ? w : [])) // 拉取失败/为空给空列表，别让转圈一直转（对齐原 App）
      .catch(() => setHotwords([]))
  }, [source])

  // 搜索建议防抖
  useEffect(() => {
    if (!query.trim() || results !== null) { setSuggestions([]); return }
    const t = window.setTimeout(() => {
      api.suggest(source, query).then(setSuggestions).catch(() => setSuggestions([]))
    }, 300)
    return () => clearTimeout(t)
  }, [query, source, results])

  const submit = async (kw: string, p = 1) => {
    const key = kw.trim()
    if (!key) return
    setQuery(key)
    setResults(null); setSuggestions([]); setError(''); setLoading(true); setPage(p)
    addHistory(key)
    try {
      const songs = await api.search(key, source, p)
      setResults(songs)
      if (songs.length === 0 && p === 1) setError('没有找到相关歌曲')
    } catch (e: any) {
      setResults([])
      setError(e?.message || '搜索失败')
    } finally {
      setLoading(false)
    }
  }

  const loadMore = async () => {
    if (!results || loading) return
    const next = page + 1
    setLoading(true)
    try {
      const more = await api.search(query, source, next)
      if (more.length === 0) toast('没有更多了')
      else { setResults([...results, ...more]); setPage(next) }
    } catch { toast('加载更多失败') } finally { setLoading(false) }
  }

  const play = (songs: Song[], index: number) => {
    usePlayer.getState().playAll(songs, index)
    nav('/player')
  }

  const showBrowse = results === null

  return (
    <div className="page">
      <div className="search-page">
        <div className="search-box">
          <Icon name="search" size={20} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (results !== null && !e.target.value) setResults(null) }}
            onKeyDown={(e) => e.key === 'Enter' && submit(query)}
            placeholder="搜索歌曲、歌手"
          />
          {query && <button className="icon-btn small" onClick={() => { setQuery(''); setResults(null); inputRef.current?.focus() }} aria-label="清空"><Icon name="close" size={18} /></button>}
        </div>

        <div className="filter-chips">
          {SOURCES.map((s) => (
            <button key={s} className={`chip ${s === source ? 'active' : ''}`}
              onClick={() => { setSource(s); if (query.trim()) submit(query) }}>
              {({ wy: '网易云', qq: 'QQ音乐', kg: '酷狗' } as Record<string, string>)[s]}
            </button>
          ))}
        </div>

        {suggestions.length > 0 && (
          <div className="suggest-list">
            {suggestions.map((s, i) => (
              <div key={i} className="suggest-row" onClick={() => submit(s)}>{s}</div>
            ))}
          </div>
        )}

        {showBrowse && (
          <div className="scroll-area browse">
            <Section title="热门搜索" />
            <div className="hotwords">
              {hotwords === null ? <span className="hotwords-loading"><span className="spinner" /></span> : hotwords.map((w, i) => (
                <button key={i} className="chip outline" onClick={() => submit(w)}>{w}</button>
              ))}
            </div>
            <Section title="搜索历史" action={history.length > 0 ? <button className="btn-text" onClick={clearHistory}>清空</button> : undefined} />
            {history.length === 0 ? (
              <div className="hint">暂无搜索历史</div>
            ) : history.map((h, i) => (
              <div key={i} className="history-row" onClick={() => submit(h)}>
                <Icon name="history" size={16} />
                <span className="ellipsis" style={{ flex: 1 }}>{h}</span>
                <button className="icon-btn small" onClick={(e) => { e.stopPropagation(); deleteHistory(h) }} aria-label="删除"><Icon name="close" size={16} /></button>
              </div>
            ))}
          </div>
        )}

        {!showBrowse && (
          <div className="scroll-area results">
            {results === null ? <LoadingBox /> : results.length === 0 ? (
              <EmptyBox text={error || '没有找到相关歌曲'} />
            ) : (
              <>
                {results.map((song, i) => (
                  <SongRow key={`${song.source}_${song.id}_${i}`} song={song}
                    active={playingKey === `${song.source}_${song.id}`}
                    trailing={<LikeButton song={song} size={22} />}
                    onPlay={() => play(results, i)} />
                ))}
                <div className="load-more" onClick={loadMore}>
                  {loading ? <span className="spinner" /> : <span>没有更多了</span>}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="section-header"><span className="section-title">{title}</span>{action}</div>
}
