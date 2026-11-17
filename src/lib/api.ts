import type { Song, PlaylistSummary, Source } from './types'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`)
  return data as T
}

export const api = {
  async search(keyword: string, source: Source, page = 1): Promise<Song[]> {
    const r = await get<{ songs: Song[]; error?: string }>(
      `/api/search?keyword=${encodeURIComponent(keyword)}&source=${source}&page=${page}`
    )
    if (r.error) throw new Error(r.error)
    return r.songs || []
  },
  async hotwords(source: Source): Promise<string[]> {
    const r = await get<{ words: string[] }>(`/api/hotwords?source=${source}`)
    return r.words || []
  },
  async suggest(source: Source, keyword: string): Promise<string[]> {
    const r = await get<{ words: string[] }>(
      `/api/suggest?source=${source}&keyword=${encodeURIComponent(keyword)}`
    )
    return r.words || []
  },
  async recommend(): Promise<PlaylistSummary[]> {
    const r = await get<{ playlists: PlaylistSummary[] }>('/api/recommend')
    return r.playlists || []
  },
  async newsongs(): Promise<Song[]> {
    const r = await get<{ songs: Song[] }>('/api/newsongs')
    return r.songs || []
  },
  async toplists(source?: Source): Promise<PlaylistSummary[]> {
    const r = await get<{ playlists: PlaylistSummary[] }>(
      `/api/toplists${source ? `?source=${source}` : ''}`
    )
    return r.playlists || []
  },
  async playlistSongs(source: string, id: string): Promise<Song[]> {
    const r = await get<{ songs: Song[] }>(
      `/api/playlist?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`
    )
    return r.songs || []
  },
  async lrc(song: Song): Promise<string> {
    const params = song._params ? `&params=${encodeURIComponent(song._params)}` : ''
    const res = await fetch(
      `/api/lrc?source=${song.source}&id=${encodeURIComponent(song.id)}` +
        `&name=${encodeURIComponent(song.name)}&artist=${encodeURIComponent(song.artist)}${params}`
    )
    if (!res.ok) throw new Error('歌词获取失败')
    return res.text()
  },
  /** 解析真实音频直链；前端优先用它，失败回退官方 outer 直链 */
  async playUrl(song: Song): Promise<string> {
    const params = song._params ? `&params=${encodeURIComponent(song._params)}` : ''
    const r = await get<{ url: string }>(
      `/api/url?source=${song.source}&id=${encodeURIComponent(song.id)}` +
        `&name=${encodeURIComponent(song.name)}&artist=${encodeURIComponent(song.artist)}${params}`
    )
    return r.url
  },
  async coverUrl(song: Song): Promise<string | null> {
    if (song.pic) return song.pic
    const params = song._params ? `&params=${encodeURIComponent(song._params)}` : ''
    try {
      const r = await get<{ url: string }>(
        `/api/pic?source=${song.source}&id=${encodeURIComponent(song.id)}` +
          `&name=${encodeURIComponent(song.name)}&artist=${encodeURIComponent(song.artist)}${params}`
      )
      return r.url
    } catch {
      return null
    }
  },
  /** 把外部 URL 变成走 Worker 的代理地址（带 Referer、绕 Mixed Content/CORS） */
  stream(url: string, source = ''): string {
    return `/api/stream?url=${encodeURIComponent(url)}&source=${encodeURIComponent(source)}`
  },
  async randomAvatar(): Promise<string> {
    const r = await get<{ url: string }>('/api/randomavatar')
    return r.url
  },
}
