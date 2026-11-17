// 聚合源 jbsou：搜索 / 取链 / 封面 / 歌词（对齐 SvipProvider.java）
// 浏览器无状态：mk_visit Cookie 每次动态获取；sign/t 参数随搜索结果返回给前端，不长期缓存

import { getText, getRedirectLocation, postForm, tryParseJson, cleanKeyword, firstNonEmpty } from './http'
import { SVIP_API, SVIP_REFERER } from './config'
import { type Song, type Source, svipType } from './types'

const VISIT_RE = /mk_visit=([0-9]+-[a-f0-9]+)/

interface VisitCache { value: string; at: number }
let visitCache: VisitCache | null = null
const VISIT_TTL = 6 * 60 * 60 * 1000

/** GET 首页取 mk_visit Cookie 挑战（上游 12h，客户端保守 6h 缓存） */
async function getVisit(force = false): Promise<string> {
  const now = Date.now()
  if (!force && visitCache && now - visitCache.at < VISIT_TTL) return visitCache.value
  const body = await getText(SVIP_API + '/')
  const m = body ? VISIT_RE.exec(body) : null
  if (!m) throw new Error('jbsou 未返回访问凭证，音源可能已变更')
  visitCache = { value: m[1], at: now }
  return m[1]
}

/** 从搜索结果的 url 字段提取公共参数 type=&id=&sign=&t= */
function extractParams(urlPath: string): string {
  const q = urlPath.indexOf('?')
  if (q < 0) return ''
  const query = urlPath.slice(q + 1)
  const amp = query.indexOf('&')
  return amp >= 0 ? query.slice(amp + 1) : query
}

async function doSearch(keyword: string, source: Source, page: number, visit: string): Promise<string> {
  return postForm(
    SVIP_API + '/',
    { input: cleanKeyword(keyword), filter: 'name', type: svipType(source), page: String(page) },
    {
      'X-Requested-With': 'XMLHttpRequest',
      Referer: SVIP_REFERER,
      Cookie: `mk_visit=${visit}`,
    }
  )
}

export interface SearchResult { songs: Song[]; error?: string }

/** 搜索：403 时刷新 mk_visit 重试一次 */
export async function search(keyword: string, source: Source, page = 1): Promise<SearchResult> {
  let visit = await getVisit()
  let body = await doSearch(keyword, source, page, visit)
  if (body.includes('"code":403') || body.includes('"code": 403')) {
    visit = await getVisit(true)
    body = await doSearch(keyword, source, page, visit)
  }
  const json = tryParseJson<any>(body)
  if (!json || json.code !== 200 || !Array.isArray(json.data)) {
    throw new Error(json?.error ? `搜索失败: ${json.error}` : '搜索失败：音源返回异常')
  }
  const songs: Song[] = []
  for (const it of json.data) {
    const songId = String(it?.songid ?? '')
    if (!songId || songId === 'null') continue
    songs.push({
      id: songId,
      source,
      name: String(it?.name ?? ''),
      artist: String(it?.artist ?? ''),
      album: '',
      picId: '',
      pic: '',
      _params: extractParams(String(it?.url ?? '')),
    })
  }
  return { songs }
}

/** 根据 params 解析真实直链 / 封面（302）或歌词（LRC 文本） */
export async function resolve(kind: 'url' | 'pic' | 'lrc', params: string): Promise<string> {
  const url = `${SVIP_API}/api.php?get=${kind}&${params}`
  if (kind === 'lrc') {
    return getText(url, { Referer: SVIP_REFERER })
  }
  return getRedirectLocation(url, { Referer: SVIP_REFERER })
}

/** 前端未带 params（如导入的歌）时：按歌名重搜定位，最多 3 页、歌名匹配 */
export async function findParams(song: Pick<Song, 'id' | 'name' | 'artist' | 'source'>): Promise<string> {
  const norm = (s: string) => s.replace(/\s/g, '').toLowerCase()
  const strip = (s: string) => s.replace(/\s*[（(][^）)]*[）)]\s*/g, '').trim()
  const queries = [song.name, strip(song.name)].filter((v, i, a) => v && a.indexOf(v) === i)
  for (const q of queries) {
    for (let page = 1; page <= 3; page++) {
      try {
        const { songs } = await search(q, song.source as Source, page)
        const exact = songs.find((s) => s.id === song.id)
        if (exact?._params) return exact._params
        const byName = songs.find((s) => norm(s.name) === norm(song.name))
        if (byName?._params) return byName._params
        if (songs.length < 10) break
      } catch {
        break
      }
    }
  }
  throw new Error('无法定位歌曲取链参数')
}

/** 带签名过期重试的解析：失败则清 params 重搜再试一次 */
export async function resolveWithParams(
  kind: 'url' | 'pic' | 'lrc',
  song: Pick<Song, 'id' | 'name' | 'artist' | 'source'>,
  params?: string
): Promise<string> {
  const p = params || (await findParams(song))
  try {
    return await resolve(kind, p)
  } catch {
    const fresh = await findParams(song)
    return resolve(kind, fresh)
  }
}

export { extractParams }
