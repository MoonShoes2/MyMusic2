// 对齐原生 App 的 ApiConfig.java：所有外部请求的 UA / Referer 唯一入口

export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

export const SVIP_API = 'https://www.jbsou.cn'
export const SVIP_REFERER = 'https://www.jbsou.cn/'
export const NETEASE_API = 'https://music.163.com'
export const NETEASE_REFERER = 'https://music.163.com/'
export const QQ_REFERER = 'https://y.qq.com/'

/** 播放音频真实 CDN 需要的头：只有酷狗要带 jbsou 的 Referer（反直觉但源码如此） */
export function playbackHeaders(source: string): Record<string, string> {
  return source === 'kg' ? { Referer: SVIP_REFERER } : {}
}

export function baseHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { 'User-Agent': USER_AGENT, ...extra }
}
