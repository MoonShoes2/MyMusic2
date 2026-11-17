// 全局状态：Three.js 无；这里是播放器 + 音乐库 + 设置，全部持久化到 localStorage
// 对齐原生 App：PlaybackStore / PlayOrderStore / LikeState / SongRepository / AppSettings

import { create } from 'zustand'
import type { Song, PlayMode, MyPlaylist } from '../lib/types'
import { songKey } from '../lib/types'

// ---------------- 持久化工具 ----------------

function load<T>(key: string, def: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : def
  } catch {
    return def
  }
}
function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value) ) } catch { /* 配额溢出忽略 */ }
}

const K = {
  queue: 'mm2.queue', index: 'mm2.index', mode: 'mm2.mode', volume: 'mm2.volume',
  position: 'mm2.position', lastKey: 'mm2.lastKey',
  liked: 'mm2.liked', recent: 'mm2.recent', playlists: 'mm2.playlists',
  history: 'mm2.history', nickname: 'mm2.nickname', avatar: 'mm2.avatar',
  darkMode: 'mm2.darkMode', lyricOffset: 'mm2.lyricOffset', sleepEnd: 'mm2.sleepEnd',
}

// ---------------- 播放 store ----------------

interface PlayerState {
  queue: Song[]
  currentIndex: number
  isPlaying: boolean
  isLoading: boolean
  positionMs: number
  durationMs: number
  volume: number
  mode: PlayMode
  error: string | null
  sleepEndAt: number | null
  pauseAfterCurrent: boolean

  playAll: (songs: Song[], index?: number) => void
  playAt: (index: number) => void
  playNext: (song: Song) => void
  removeAt: (index: number) => void
  next: (auto?: boolean) => void
  prev: () => void
  toggle: () => void
  setPlaying: (v: boolean) => void
  setLoading: (v: boolean) => void
  setPosition: (ms: number) => void
  setDuration: (ms: number) => void
  setVolume: (v: number) => void
  cycleMode: () => void
  setError: (msg: string | null) => void
  stop: () => void
  setSleepTimer: (minutes: number | null, afterCurrent?: boolean) => void
}

function shuffled(songs: Song[], keepIndex: number): Song[] {
  if (songs.length <= 1) return [...songs]
  const head = songs.slice(0, keepIndex + 1)
  const tail = songs.slice(keepIndex + 1)
  for (let i = tail.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[tail[i], tail[j]] = [tail[j], tail[i]]
  }
  return [...head, ...tail]
}

export const usePlayer = create<PlayerState>((set, get) => ({
  queue: load(K.queue, []),
  currentIndex: load(K.index, -1),
  isPlaying: false,
  isLoading: false,
  positionMs: 0,
  durationMs: 0,
  volume: load(K.volume, 1),
  mode: load(K.mode, 'list' as PlayMode),
  error: null,
  sleepEndAt: load(K.sleepEnd, null),
  pauseAfterCurrent: false,

  playAll: (songs, index = 0) => {
    if (!songs.length) return
    let queue = [...songs]
    const mode = get().mode
    if (mode === 'shuffle') queue = shuffled(queue, index)
    const lastKey = load<string>(K.lastKey, '')
    const resume = queue[index] && songKey(queue[index]) === lastKey ? load<number>(K.position, 0) : 0
    set({ queue, currentIndex: index, positionMs: resume, isPlaying: true, isLoading: true, error: null })
    save(K.queue, queue); save(K.index, index)
  },
  playAt: (index) => {
    const { queue } = get()
    if (index < 0 || index >= queue.length) return
    set({ currentIndex: index, positionMs: 0, isPlaying: true, isLoading: true, error: null })
    save(K.index, index)
  },
  playNext: (song) => {
    const { queue, currentIndex } = get()
    let nextQueue = queue.filter((s) => songKey(s) !== songKey(song))
    const insertAt = Math.min(currentIndex + 1, nextQueue.length)
    nextQueue.splice(insertAt, 0, song)
    set({ queue: nextQueue, isPlaying: true, isLoading: true, error: null })
    save(K.queue, nextQueue); save(K.index, insertAt)
    set({ currentIndex: insertAt })
    save(K.index, insertAt)
  },
  removeAt: (index) => {
    const { queue, currentIndex } = get()
    if (index === currentIndex || index < 0 || index >= queue.length) return
    const nextQueue = queue.filter((_, i) => i !== index)
    const nextIndex = index < currentIndex ? currentIndex - 1 : currentIndex
    set({ queue: nextQueue, currentIndex: nextIndex })
    save(K.queue, nextQueue); save(K.index, nextIndex)
  },
  next: (auto = false) => {
    const { queue, currentIndex, mode, pauseAfterCurrent, error } = get()
    if (!queue.length) return
    if (auto && pauseAfterCurrent) {
      set({ isPlaying: false, pauseAfterCurrent: false })
      return
    }
    let nextIndex: number
    if (mode === 'single' && auto) {
      nextIndex = currentIndex
    } else if (currentIndex < queue.length - 1) {
      nextIndex = currentIndex + 1
    } else if (mode === 'shuffle') {
      nextIndex = 0
    } else {
      nextIndex = 0
    }
    void error
    set({ currentIndex: nextIndex, positionMs: 0, isPlaying: true, isLoading: true, error: null })
    save(K.index, nextIndex)
  },
  prev: () => {
    const { queue, currentIndex } = get()
    if (!queue.length) return
    const idx = currentIndex > 0 ? currentIndex - 1 : queue.length - 1
    set({ currentIndex: idx, positionMs: 0, isPlaying: true, isLoading: true, error: null })
    save(K.index, idx)
  },
  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPlaying: (v) => set({ isPlaying: v }),
  setLoading: (v) => set({ isLoading: v }),
  setPosition: (ms) => {
    set({ positionMs: ms })
    const { queue, currentIndex } = get()
    const song = queue[currentIndex]
    if (song) {
      save(K.position, Math.floor(ms)); save(K.lastKey, songKey(song))
    }
  },
  setDuration: (ms) => set({ durationMs: ms }),
  setVolume: (v) => { set({ volume: v }); save(K.volume, v) },
  cycleMode: () => {
    const order: PlayMode[] = ['list', 'single', 'shuffle']
    const { mode, queue, currentIndex } = get()
    const nextMode = order[(order.indexOf(mode) + 1) % order.length]
    let nextQueue = queue
    let nextIndex = currentIndex
    if (nextMode === 'shuffle' && mode !== 'shuffle') {
      nextQueue = shuffled(queue, currentIndex)
      save(K.queue, nextQueue)
    }
    set({ mode: nextMode, queue: nextQueue, currentIndex: nextIndex })
    save(K.mode, nextMode)
  },
  setError: (msg) => set({ error: msg }),
  stop: () => {
    set({ queue: [], currentIndex: -1, isPlaying: false, isLoading: false, positionMs: 0, durationMs: 0 })
    save(K.queue, []); save(K.index, -1)
  },
  setSleepTimer: (minutes, afterCurrent = false) => {
    if (afterCurrent) set({ sleepEndAt: null, pauseAfterCurrent: true })
    else if (minutes == null) set({ sleepEndAt: null, pauseAfterCurrent: false })
    else {
      set({ sleepEndAt: Date.now() + minutes * 60000, pauseAfterCurrent: false })
    }
    save(K.sleepEnd, get().sleepEndAt)
  },
}))

// ---------------- 音乐库 store ----------------

interface LibraryState {
  liked: string[]           // songKey[]
  likedSongs: Song[]        // 完整歌曲（用于展示，含 _params）
  recentSongs: Song[]
  playlists: MyPlaylist[]
  history: string[]
  nickname: string
  avatar: string

  isLiked: (song: Song) => boolean
  toggleLike: (song: Song) => boolean
  recordPlay: (song: Song) => void
  removeRecent: (song: Song) => void
  createPlaylist: (name: string) => MyPlaylist
  deletePlaylist: (id: number) => void
  renamePlaylist: (id: number, name: string) => void
  addToPlaylist: (id: number, songs: Song[]) => number
  removeFromPlaylist: (id: number, song: Song) => void
  addHistory: (kw: string) => void
  clearHistory: () => void
  deleteHistory: (kw: string) => void
  setNickname: (v: string) => void
  setAvatar: (v: string) => void
  importSongs: (songs: Song[]) => number
}

export const useLibrary = create<LibraryState>((set, get) => ({
  liked: load(K.liked, []),
  likedSongs: load('mm2.likedSongs', []),
  recentSongs: load('mm2.recentSongs', []),
  playlists: load(K.playlists, []),
  history: load(K.history, []),
  nickname: load(K.nickname, ''),
  avatar: load(K.avatar, ''),

  isLiked: (song) => get().liked.includes(songKey(song)),
  toggleLike: (song) => {
    const key = songKey(song)
    const liked = [...get().liked]
    let likedSongs = [...get().likedSongs]
    const idx = liked.indexOf(key)
    let nowLiked: boolean
    if (idx >= 0) {
      liked.splice(idx, 1)
      likedSongs = likedSongs.filter((s) => songKey(s) !== key)
      nowLiked = false
    } else {
      liked.unshift(key)
      likedSongs = [song, ...likedSongs.filter((s) => songKey(s) !== key)]
      nowLiked = true
    }
    set({ liked, likedSongs })
    save(K.liked, liked); save('mm2.likedSongs', likedSongs)
    return nowLiked
  },
  recordPlay: (song) => {
    const key = songKey(song)
    // 同源 + 同名 + 同歌手去重
    const recentSongs = [song, ...get().recentSongs.filter(
      (s) => !(s.source === song.source && s.name === song.name && s.artist === song.artist)
    )].slice(0, 200)
    set({ recentSongs })
    save('mm2.recentSongs', recentSongs)
  },
  removeRecent: (song) => {
    const recentSongs = get().recentSongs.filter((s) => songKey(s) !== songKey(song))
    set({ recentSongs }); save('mm2.recentSongs', recentSongs)
  },
  createPlaylist: (name) => {
    const pl: MyPlaylist = { id: Date.now(), name, songs: [], createdAt: Date.now() }
    const playlists = [pl, ...get().playlists]
    set({ playlists }); save(K.playlists, playlists)
    return pl
  },
  deletePlaylist: (id) => {
    const playlists = get().playlists.filter((p) => p.id !== id)
    set({ playlists }); save(K.playlists, playlists)
  },
  renamePlaylist: (id, name) => {
    const playlists = get().playlists.map((p) => (p.id === id ? { ...p, name } : p))
    set({ playlists }); save(K.playlists, playlists)
  },
  addToPlaylist: (id, songs) => {
    const playlists = get().playlists.map((p) => {
      if (p.id !== id) return p
      const existing = new Set(p.songs.map(songKey))
      const fresh = songs.filter((s) => !existing.has(songKey(s)))
      return { ...p, songs: [...fresh, ...p.songs] }
    })
    set({ playlists }); save(K.playlists, playlists)
    const target = playlists.find((p) => p.id === id)
    return songs.length - (target ? target.songs.length - get().playlists.find((p) => p.id === id)!.songs.length : 0)
  },
  removeFromPlaylist: (id, song) => {
    const playlists = get().playlists.map((p) =>
      p.id === id ? { ...p, songs: p.songs.filter((s) => songKey(s) !== songKey(song)) } : p
    )
    set({ playlists }); save(K.playlists, playlists)
  },
  addHistory: (kw) => {
    const k = kw.trim()
    if (!k) return
    const history = [k, ...get().history.filter((h) => h !== k)].slice(0, 10)
    set({ history }); save(K.history, history)
  },
  clearHistory: () => { set({ history: [] }); save(K.history, []) },
  deleteHistory: (kw) => {
    const history = get().history.filter((h) => h !== kw)
    set({ history }); save(K.history, history)
  },
  setNickname: (v) => { set({ nickname: v }); save(K.nickname, v) },
  setAvatar: (v) => { set({ avatar: v }); save(K.avatar, v) },
  importSongs: (songs) => {
    const liked = [...get().liked]
    const likedSongs = [...get().likedSongs]
    let added = 0
    for (const s of songs) {
      const key = songKey(s)
      if (!liked.includes(key)) {
        liked.unshift(key)
        likedSongs.unshift(s)
        added++
      }
    }
    set({ liked, likedSongs })
    save(K.liked, liked); save('mm2.likedSongs', likedSongs)
    return added
  },
}))

// ---------------- 设置 store ----------------

type DarkMode = 'system' | 'light' | 'dark'

interface SettingsState {
  darkMode: DarkMode
  lyricOffset: number  // ms，按当前源简化为全局（原生是按源分开）
  setDarkMode: (v: DarkMode) => void
  cycleDarkMode: () => void
  setLyricOffset: (v: number) => void
}

export const useSettings = create<SettingsState>((set, get) => ({
  darkMode: load(K.darkMode, 'system'),
  lyricOffset: load(K.lyricOffset, 0),
  setDarkMode: (v) => { set({ darkMode: v }); save(K.darkMode, v) },
  cycleDarkMode: () => {
    const order: DarkMode[] = ['system', 'light', 'dark']
    const v = order[(order.indexOf(get().darkMode) + 1) % order.length]
    set({ darkMode: v }); save(K.darkMode, v)
  },
  setLyricOffset: (v) => {
    const clamped = Math.max(-3000, Math.min(3000, v))
    set({ lyricOffset: clamped }); save(K.lyricOffset, clamped)
  },
}))

export function currentSong(state: PlayerState): Song | null {
  return state.queue[state.currentIndex] || null
}
