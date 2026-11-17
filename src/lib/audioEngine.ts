// 全局音频引擎：单例 HTMLAudioElement，驱动 Zustand 播放状态
// 对齐原生 Media3PlaybackKernel：真实 URL 按需解析、进度心跳、连续失败跳歌

import { api } from '../lib/api'
import { songKey } from '../lib/types'
import { usePlayer, useLibrary } from '../store/useStore'

class AudioEngine {
  private audio: HTMLAudioElement
  private resolveCache = new Map<string, { url: string; at: number }>()
  private failures = 0
  private tickTimer: number | null = null
  private sleepTimer: number | null = null
  private lastSongKey = ''
  private unsubscribed: (() => void) | null = null
  private initialized = false

  constructor() {
    this.audio = new Audio()
    this.audio.preload = 'auto'
    this.audio.crossOrigin = 'anonymous'
  }

  init() {
    if (this.initialized) return
    this.initialized = true

    this.audio.addEventListener('timeupdate', () => {
      const s = usePlayer.getState()
      s.setPosition(this.audio.currentTime * 1000)
    })
    this.audio.addEventListener('durationchange', () => {
      if (Number.isFinite(this.audio.duration)) usePlayer.getState().setDuration(this.audio.duration * 1000)
    })
    this.audio.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(this.audio.duration)) usePlayer.getState().setDuration(this.audio.duration * 1000)
      usePlayer.getState().setLoading(false)
      this.failures = 0
    })
    this.audio.addEventListener('playing', () => {
      usePlayer.getState().setPlaying(true)
      usePlayer.getState().setLoading(false)
    })
    this.audio.addEventListener('pause', () => {
      if (!this.audio.ended) usePlayer.getState().setPlaying(false)
    })
    this.audio.addEventListener('waiting', () => usePlayer.getState().setLoading(true))
    this.audio.addEventListener('error', () => this.onError(new Error('音频加载失败')))
    this.audio.addEventListener('ended', () => {
      const s = usePlayer.getState()
      // 单曲循环：mode=single 时重播
      if (s.mode === 'single') {
        this.audio.currentTime = 0
        this.audio.play().catch(() => {})
      } else {
        s.next(true)
      }
    })

    // 音量同步
    this.audio.volume = usePlayer.getState().volume

    // 订阅 store：切歌 / 播放态 / 音量变化时驱动 audio
    this.unsubscribed = usePlayer.subscribe((state, prev) => {
      const song = state.queue[state.currentIndex]
      const songChanged = state.currentIndex !== prev.currentIndex || state.queue !== prev.queue
      if (songChanged) {
        if (song) this.loadSong(song, state.positionMs)
        else { this.audio.pause(); this.audio.src = '' }
      }
      if (state.volume !== prev.volume) this.audio.volume = state.volume
      if (state.isPlaying !== prev.isPlaying) {
        if (state.isPlaying) this.audio.play().catch((e) => this.onError(e))
        else this.audio.pause()
      }
      if (state.sleepEndAt !== prev.sleepEndAt) this.scheduleSleep(state.sleepEndAt)
    })

    // 当前若有恢复的队列，加载当前歌
    const s = usePlayer.getState()
    const cur = s.queue[s.currentIndex]
    if (cur) this.loadSong(cur, s.positionMs)

    this.tickTimer = window.setInterval(() => {
      const s = usePlayer.getState()
      if (s.isPlaying && s.queue[s.currentIndex]) s.setPosition(this.audio.currentTime * 1000)
    }, 500)
  }

  private async loadSong(song: import('../lib/types').Song, resumeMs: number) {
    const key = songKey(song)
    this.lastSongKey = key
    const s = usePlayer.getState()
    s.setLoading(true)
    s.setError(null)
    this.failures = 0

    try {
      let real = this.resolveCache.get(key)
      if (!real || Date.now() - real.at > 110000) {
        const url = await api.playUrl(song)
        real = { url, at: Date.now() }
        this.resolveCache.set(key, real)
      }
      // 音频流走 Worker 代理：带正确 Referer、绕过 Mixed Content
      const streamed = api.stream(real.url, song.source)
      if (this.audio.src !== new URL(streamed, location.href).href) {
        this.audio.src = streamed
      }
      this.audio.load()
      if (resumeMs > 0) {
        const doSeek = () => {
          try { this.audio.currentTime = resumeMs / 1000 } catch { /* 忽略 */ }
          this.audio.removeEventListener('loadedmetadata', doSeek)
        }
        this.audio.addEventListener('loadedmetadata', doSeek)
      }
      if (usePlayer.getState().isPlaying) {
        await this.audio.play().catch((e) => this.onError(e))
      }
      useLibrary.getState().recordPlay(song)
    } catch (e: any) {
      this.onError(e)
    }
  }

  seek(ms: number) {
    try { this.audio.currentTime = Math.max(0, ms / 1000) } catch { /* 忽略 */ }
    usePlayer.getState().setPosition(ms)
  }

  private onError(e: any) {
    const s = usePlayer.getState()
    s.setLoading(false)
    this.failures++
    if (this.failures >= 3) {
      s.setError('连续 3 首无法播放，已停止自动跳转')
      s.setPlaying(false)
      return
    }
    s.setError(`播放失败：${e?.message || '音源不可用'}`)
    // 队列 >1 时自动跳下一首（异步，避免递归）
    if (s.queue.length > 1) window.setTimeout(() => usePlayer.getState().next(true), 300)
  }

  private scheduleSleep(endAt: number | null) {
    if (this.sleepTimer) { clearTimeout(this.sleepTimer); this.sleepTimer = null }
    if (!endAt) return
    const delay = endAt - Date.now()
    if (delay <= 0) {
      usePlayer.getState().setPlaying(false)
      return
    }
    this.sleepTimer = window.setTimeout(() => usePlayer.getState().setPlaying(false), delay)
  }
}

export const audioEngine = new AudioEngine()
