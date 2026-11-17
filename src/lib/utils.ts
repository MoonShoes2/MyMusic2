import type { Song } from './types'

/** 毫秒 → mm:ss */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00'
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** 播放量格式化 */
export function formatPlayCount(n: number): string {
  if (!n || n <= 0) return ''
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}亿`
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`
  return String(n)
}

/** 歌单副标题：音源 · 共 N 首 · 播放量 */
export function playlistSubtitle(
  p: { source: string; trackCount: number; playCount: number },
  showSource = true,
  showTrackCount = false
): string {
  const parts: string[] = []
  if (showSource) parts.push(({ wy: '网易云', qq: 'QQ音乐', kg: '酷狗' } as Record<string, string>)[p.source] || p.source)
  if (showTrackCount && p.trackCount) parts.push(`共 ${p.trackCount} 首`)
  if (p.playCount) parts.push(formatPlayCount(p.playCount))
  return parts.join(' · ')
}

// ---------------- LRC 歌词解析 ----------------

export interface LyricLine { timeMs: number; text: string }

const TIME_TAG = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g

export function parseLrc(lrc: string): LyricLine[] {
  const out: LyricLine[] = []
  if (!lrc) return out
  for (const rawLine of lrc.split(/\r?\n/)) {
    const tags: number[] = []
    TIME_TAG.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = TIME_TAG.exec(rawLine)) !== null) {
      const min = Number(m[1])
      const sec = Number(m[2])
      let frac = 0
      if (m[3]) {
        frac = Number(m[3])
        for (let i = m[3].length; i < 3; i++) frac *= 10
      }
      tags.push(min * 60000 + sec * 1000 + frac)
    }
    if (!tags.length) continue
    const text = rawLine.replace(TIME_TAG, '').trim()
    for (const timeMs of tags) out.push({ timeMs, text })
  }
  out.sort((a, b) => a.timeMs - b.timeMs)
  return out
}

export function isValidLrc(lrc: string): boolean {
  return /\[\d{1,2}:\d{1,2}[.:]?\d*\]/.test(lrc)
}

/** 二分查找：最后一个 timeMs <= position 的行索引 */
export function findLyricIndex(lines: LyricLine[], positionMs: number): number {
  if (!lines.length) return -1
  let lo = 0, hi = lines.length - 1, ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].timeMs <= positionMs) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return ans
}

// ---------------- 歌单导入导出编解码（对齐 ExportImportManager）----------------

/** 每首歌编码为 [source, id, name, artist] */
export function encodePlaylist(songs: Song[]): Promise<string> {
  const arr = songs.map((s) => [s.source, s.id, s.name, s.artist])
  const json = JSON.stringify(arr)
  const bytes = new TextEncoder().encode(json)
  // 用浏览器的 CompressionStream('deflate') 压缩（zlib）
  return new Promise<string>((resolve) => {
    const cs = new CompressionStream('deflate')
    const writer = cs.writable.getWriter()
    writer.write(bytes)
    writer.close()
    const chunks: Uint8Array[] = []
    const reader = cs.readable.getReader()
    const pump = async () => {
      const { done, value } = await reader.read()
      if (done) {
        let bin = ''
        for (const c of chunks) for (const b of c) bin += String.fromCharCode(b)
        const compressed = btoa(bin)
        // 选较短者：MZ:(压缩) vs MM:(原始 base64)
        const rawB64 = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''))
        resolve(`MZ:${compressed}`.length <= `MM:${rawB64}`.length ? `MZ:${compressed}` : `MM:${rawB64}`)
        return
      }
      chunks.push(value)
      pump()
    }
    pump()
  })
}

export async function decodePlaylist(text: string): Promise<Song[] | null> {
  if (!text) return null
  let t = text.replace(/^\uFEFF/, '').trim()
  try {
    let jsonStr = ''
    if (t.startsWith('MZ:')) {
      const bin = atob(t.slice(3))
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
      const ds = new DecompressionStream('deflate')
      const writer = ds.writable.getWriter()
      writer.write(bytes)
      writer.close()
      const chunks: Uint8Array[] = []
      const reader = ds.readable.getReader()
      const pump = async () => {
        const { done, value } = await reader.read()
        if (done) return
        chunks.push(value)
        await pump()
      }
      await pump()
      const total = chunks.reduce((n, c) => n + c.length, 0)
      const merged = new Uint8Array(total)
      let off = 0
      for (const c of chunks) { merged.set(c, off); off += c.length }
      jsonStr = new TextDecoder().decode(merged)
    } else if (t.startsWith('MM:')) {
      const bin = atob(t.slice(3))
      jsonStr = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
    } else {
      return null
    }
    if (jsonStr.length > 5 * 1024 * 1024) return null
    const arr = JSON.parse(jsonStr)
    if (!Array.isArray(arr)) return null
    return arr
      .filter((x) => Array.isArray(x) && x.length >= 2)
      .map((x) => ({
        source: String(x[0]), id: String(x[1]), name: String(x[2] || ''),
        artist: String(x[3] || ''), album: '', picId: '', pic: '',
      }))
  } catch {
    return null
  }
}

/** 分片导出（每段都是完整可独立导入的文本） */
export function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  // 简单按字符切片；实际二维码容量按调用方传入
  const out: string[] = []
  for (let i = 0; i < text.length; i += maxChars) out.push(text.slice(i, i + maxChars))
  return out
}
