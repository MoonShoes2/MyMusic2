// 前端共享类型（与 functions/api/_lib/types.ts 对齐）

export interface Song {
  id: string
  source: string
  name: string
  artist: string
  album: string
  picId: string
  pic: string
  _params?: string
}

export interface PlaylistSummary {
  id: string
  name: string
  coverUrl: string | null
  source: string
  playCount: number
  trackCount: number
}

export interface MyPlaylist {
  id: number
  name: string
  songs: Song[]
  createdAt: number
}

export type PlayMode = 'list' | 'single' | 'shuffle'

export const SOURCES = ['wy', 'qq', 'kg'] as const
export type Source = (typeof SOURCES)[number]

export function sourceLabel(source: string): string {
  return ({ wy: '网易云', qq: 'QQ音乐', kg: '酷狗' } as Record<string, string>)[source] || source
}

export function songKey(song: Pick<Song, 'source' | 'id'>): string {
  return `${song.source}_${song.id}`
}
