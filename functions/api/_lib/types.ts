// 统一数据模型（对齐原生 App 的 Song / PlaylistSummary）

export interface Song {
  id: string
  source: string // wy | qq | kg
  name: string
  artist: string
  album: string
  picId: string
  pic: string
  /** jbsou 搜索返回的公共参数 type=&id=&sign=&t=，仅内存使用，不持久化 */
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

export const SOURCES = ['wy', 'qq', 'kg'] as const
export type Source = (typeof SOURCES)[number]

export function sourceLabel(source: string): string {
  return ({ wy: '网易云', qq: 'QQ音乐', kg: '酷狗' } as Record<string, string>)[source] || source
}

/** 搜索接口的 type 参数：简写 → 全称 */
export function svipType(source: string): string {
  return ({ wy: 'netease', qq: 'qq', kg: 'kugou' } as Record<string, string>)[source] || source
}

/** 全称 → 简写 */
export function fromSvipType(type: string): string {
  return ({ netease: 'wy', qq: 'qq', kugou: 'kg' } as Record<string, string>)[type] || type
}
