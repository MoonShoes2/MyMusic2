// 三家官方源：榜单 / 歌单详情 / 推荐 / 新歌 / 热搜词 / 搜索建议
// 对齐 NeteaseOfficialProvider / KugouOfficialProvider / QqOfficialProvider

import { getText, postForm, postJson, stripKgTag, tryParseJson, safeNumber, firstNonEmpty } from './http'
import { NETEASE_API, NETEASE_REFERER, QQ_REFERER } from './config'
import { type Song, type PlaylistSummary, type Source } from './types'

const neteaseHdr = { Referer: NETEASE_REFERER }
const qqHdr = { Referer: QQ_REFERER }

function coverUrl(raw: unknown): string | null {
  let url = String(raw ?? '')
  if (!url) return null
  if (url.startsWith('http://')) url = 'https://' + url.slice(7)
  if (!url.includes('?')) url += '?param=300y300'
  return url
}

/** 解析网易 track（榜单/歌单/新歌共用），兼容 al/artists 新旧字段 */
function parseNeteaseTrack(t: any): Song {
  const ar = t?.ar || t?.artists || []
  const artist = Array.isArray(ar) ? ar.map((a: any) => a?.name).filter(Boolean).join('/') : ''
  const al = t?.al || t?.album || {}
  return {
    id: String(t?.id ?? ''),
    source: 'wy',
    name: String(t?.name ?? ''),
    artist,
    album: String(al?.name ?? ''),
    picId: '',
    pic: coverUrl(al?.picUrl) || '',
  }
}

function neteaseSummary(it: any): PlaylistSummary {
  return {
    id: String(it?.id ?? ''),
    name: String(it?.name ?? ''),
    coverUrl: coverUrl(it?.coverImgUrl || it?.picUrl),
    source: 'wy',
    playCount: safeNumber(it?.playCount),
    trackCount: safeNumber(it?.trackCount),
  }
}

/** 网易榜单列表 GET /api/toplist */
export async function neteaseToplists(): Promise<PlaylistSummary[]> {
  const body = await getText(`${NETEASE_API}/api/toplist`, neteaseHdr)
  const json = tryParseJson<any>(body)
  const list = json?.list
  return Array.isArray(list) ? list.map(neteaseSummary) : []
}

/** 网易歌单/榜单详情 POST /api/v6/playlist/detail（n=1000 拿全量） */
export async function neteasePlaylistSongs(id: string): Promise<Song[]> {
  const body = await postForm(
    `${NETEASE_API}/api/v6/playlist/detail`,
    { id, n: '1000', s: '8' },
    neteaseHdr
  )
  const json = tryParseJson<any>(body)
  const tracks = json?.playlist?.tracks
  return Array.isArray(tracks) ? tracks.map(parseNeteaseTrack) : []
}

/** 网易推荐歌单 GET /api/personalized/playlist?limit=10 */
export async function neteaseRecommend(): Promise<PlaylistSummary[]> {
  const body = await getText(`${NETEASE_API}/api/personalized/playlist?limit=10`, neteaseHdr)
  const json = tryParseJson<any>(body)
  const result = json?.result
  return Array.isArray(result) ? result.map(neteaseSummary) : []
}

/** 网易新歌 GET /api/personalized/newsong?limit=10 */
export async function neteaseNewsongs(): Promise<Song[]> {
  const body = await getText(`${NETEASE_API}/api/personalized/newsong?limit=10`, neteaseHdr)
  const json = tryParseJson<any>(body)
  const result = json?.result
  if (!Array.isArray(result)) return []
  return result.map((it: any) => parseNeteaseTrack(it?.song || it))
}

/** 新歌速递（只有网易提供），供路由调用 */
export async function newsongs(): Promise<Song[]> {
  return neteaseNewsongs()
}

/** 网易热搜 GET /api/search/hot?type=1111 → result.hots[].first（对齐原 App NeteaseOfficialProvider） */
export async function neteaseHotwords(): Promise<string[]> {
  const body = await getText(`${NETEASE_API}/api/search/hot?type=1111`, neteaseHdr)
  const json = tryParseJson<any>(body)
  const arr = json?.result?.hots || json?.result?.hotWords || []
  if (!Array.isArray(arr)) return []
  const out: string[] = []
  for (const w of arr) {
    const word = String(w?.first ?? w?.word ?? w?.key ?? w ?? '').trim()
    if (word && !out.includes(word)) {
      out.push(word)
      if (out.length >= 10) break // 原版限 10 条
    }
  }
  return out
}

// ---------------- QQ 音乐 ----------------

const QQ_MUSICU = 'https://u.y.qq.com/cgi-bin/musicu.fcg'

function qqCover(albumMid: string, direct?: string): string | null {
  if (direct) {
    let u = String(direct)
    if (u.startsWith('http://')) u = 'https://' + u.slice(7)
    return u
  }
  return albumMid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg` : null
}

function parseQQTrack(t: any, source: string = 'qq'): Song {
  const singers = t?.singer || t?.singers || []
  const artist = Array.isArray(singers) && singers.length
    ? singers.map((s: any) => s?.name).filter(Boolean).join('/')
    : String(firstNonEmpty(t?.singerName, ''))
  const album = t?.album || {}
  const albumMid = firstNonEmpty(t?.songMid && t?.albumMid, t?.albummid, album?.mid, '')
  const albumName = firstNonEmpty(t?.albumName, t?.albumname, album?.name, '')
  const id = firstNonEmpty(t?.songMid, t?.songmid, t?.mid, '')
  const name = firstNonEmpty(t?.title, t?.songName, t?.songname, t?.name, '')
  return {
    id,
    source,
    name,
    artist,
    album: albumName,
    picId: albumMid,
    pic: qqCover(albumMid, t?.albumcover) || '',
  }
}

/** QQ 榜单列表 */
export async function qqToplists(): Promise<PlaylistSummary[]> {
  const body = await postJson(QQ_MUSICU, {
    'music.musicToplist.Toplist.GetAll': {
      module: 'music.musicToplist.Toplist',
      method: 'GetAll',
      param: {},
    },
  }, qqHdr)
  const json = tryParseJson<any>(body)
  const groups = json?.['music.musicToplist.Toplist.GetAll']?.data?.group || []
  const out: PlaylistSummary[] = []
  for (const g of groups) {
    for (const t of g?.toplist || []) {
      out.push({
        id: String(t?.topId ?? ''),
        name: String(t?.title ?? ''),
        coverUrl: t?.headPicUrl ? String(t.headPicUrl) : null,
        source: 'qq',
        playCount: safeNumber(t?.listenNum),
        trackCount: safeNumber(t?.totalNum),
      })
    }
  }
  return out
}

/** QQ 榜单详情（topId） */
export async function qqToplistSongs(id: string): Promise<Song[]> {
  const body = await postJson(QQ_MUSICU, {
    'music.musicToplist.Toplist.GetDetail': {
      module: 'music.musicToplist.Toplist',
      method: 'GetDetail',
      param: { topId: Number(id), offset: 0, num: 100, withTags: false },
    },
  }, qqHdr)
  const json = tryParseJson<any>(body)
  const d = json?.['music.musicToplist.Toplist.GetDetail']?.data || {}
  const list = d?.songInfoList || d?.song || []
  return Array.isArray(list) ? list.map((t: any) => parseQQTrack(t)) : []
}

/** QQ 推荐歌单 */
export async function qqRecommend(): Promise<PlaylistSummary[]> {
  const body = await postJson(QQ_MUSICU, {
    'music.playlist.PlaylistSquare.GetRecommendFeed': {
      module: 'music.playlist.PlaylistSquare',
      method: 'GetRecommendFeed',
      param: { From: 0, Size: 5 },
    },
  }, qqHdr)
  const json = tryParseJson<any>(body)
  const list = json?.['music.playlist.PlaylistSquare.GetRecommendFeed']?.data?.List || []
  const out: PlaylistSummary[] = []
  for (const it of list) {
    const b = it?.Playlist?.basic || {}
    const c = b?.cover || {}
    const cover = firstNonEmpty(c?.small_url, c?.medium_url, c?.default_url, c?.big_url)
    out.push({
      id: String(b?.tid ?? ''),
      name: String(b?.title ?? ''),
      coverUrl: cover || null,
      source: 'qq',
      playCount: safeNumber(b?.play_cnt),
      trackCount: safeNumber(b?.song_cnt),
    })
  }
  return out
}

/** QQ 歌单详情（disstid，长串） */
export async function qqPlaylistSongs(id: string): Promise<Song[]> {
  const url =
    `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1` +
    `&onlysong=0&new_format=1&disstid=${encodeURIComponent(id)}&g_tk=5381&loginUin=0` +
    `&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0`
  const body = await getText(url, qqHdr)
  const json = tryParseJson<any>(body)
  const list = json?.cdlist?.[0]?.songlist || []
  return Array.isArray(list) ? list.map((t: any) => parseQQTrack(t)) : []
}

/** QQ 热搜 */
export async function qqHotwords(): Promise<string[]> {
  const body = await getText('https://c.y.qq.com/splcloud/fcgi-bin/gethotkey.fcg', qqHdr)
  const json = tryParseJson<any>(body)
  const arr = json?.data?.hotkey || []
  return Array.isArray(arr) ? arr.slice(0, 20).map((w: any) => String(w?.k ?? '')).filter(Boolean) : []
}

/** QQ 搜索建议 */
export async function qqSuggest(keyword: string): Promise<string[]> {
  const body = await getText(
    `https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg?key=${encodeURIComponent(keyword)}`,
    qqHdr
  )
  const json = tryParseJson<any>(body)
  const arr = json?.data?.song?.item || []
  return Array.isArray(arr) ? arr.slice(0, 10).map((w: any) => String(w?.name ?? '')).filter(Boolean) : []
}

// ---------------- 酷狗 ----------------

const KG_RANK_API = 'http://mobilecdnbj.kugou.com/api/v3'

function kgCover(raw: unknown): string | null {
  let u = String(raw ?? '')
  if (!u) return null
  u = u.replace(/\{size\}/g, '300')
  if (u.startsWith('http://')) u = 'https://' + u.slice(7)
  return u
}

function parseKgTrack(t: any): Song {
  const authors = t?.authors || []
  const artist = Array.isArray(authors) && authors.length
    ? authors.map((a: any) => a?.author_name).filter(Boolean).join('、')
    : String(t?.author_name ?? '')
  return {
    id: String(t?.hash ?? ''),
    source: 'kg',
    name: String(firstNonEmpty(t?.songname, t?.song_name, '')),
    artist,
    album: String(firstNonEmpty(t?.albumname, t?.album_name, '')),
    picId: String(t?.album_id ?? ''),
    pic: kgCover(firstNonEmpty(t?.album_sizable_cover, t?.album_img, t?.trans_param?.union_cover, '')) || '',
  }
}

/** 酷狗榜单列表 GET m.kugou.com/rank/list&json=true（& 不是 ?，历史怪癖） */
export async function kugouToplists(): Promise<PlaylistSummary[]> {
  const body = await getText('https://m.kugou.com/rank/list&json=true')
  const clean = stripKgTag(body)
  const json = tryParseJson<any>(clean)
  const list = json?.rank?.list || []
  return Array.isArray(list)
    ? list.map((t: any) => ({
        id: String(t?.rankid ?? ''),
        name: String(t?.rankname ?? ''),
        coverUrl: kgCover(t?.imgurl),
        source: 'kg',
        playCount: safeNumber(t?.play_times),
        trackCount: 0,
      }))
    : []
}

/** 酷狗榜单详情 GET /api/v3/rank/song */
export async function kugouToplistSongs(id: string): Promise<Song[]> {
  const url = `${KG_RANK_API}/rank/song?version=9108&plat=0&pagesize=100&page=1&area_code=1&rankid=${encodeURIComponent(id)}&volid=0&with_res_tag=1`
  const body = await getText(url)
  const json = tryParseJson<any>(stripKgTag(body))
  const list = json?.data?.info || []
  return Array.isArray(list) ? list.map(parseKgTrack) : []
}

/** 酷狗热搜 */
export async function kugouHotwords(): Promise<string[]> {
  const body = await getText(`${KG_RANK_API}/search/hot?version=9108&plat=0`)
  const json = tryParseJson<any>(stripKgTag(body))
  const arr = json?.data || json?.data?.list || []
  if (!Array.isArray(arr)) return []
  return arr.slice(0, 20).map((w: any) => String(w?.name ?? w?.word ?? '')).filter(Boolean)
}

/** 酷狗搜索建议 */
export async function kugouSuggest(keyword: string): Promise<string[]> {
  const body = await getText(
    `https://searchtip.kugou.com/getSearchTip?keyword=${encodeURIComponent(keyword)}&Muserid=&token=`
  )
  let json = tryParseJson<any>(body)
  if (!json) {
    // 可能是 JSONP：callback({...})
    const m = body.match(/[({]([\s\S]*)[)}]\s*;?\s*$/)
    if (m) json = tryParseJson<any>(m[1])
  }
  const arr = json?.data?.list || json?.list || json?.data || []
  if (!Array.isArray(arr)) return []
  return arr.slice(0, 10).map((w: any) => String(w?.word ?? w?.name ?? '')).filter(Boolean)
}

/** 按音源取热搜（酷狗→QQ→网易 降级） */
export async function hotwords(source: Source): Promise<string[]> {
  try {
    if (source === 'kg') return await kugouHotwords()
    if (source === 'qq') return await qqHotwords()
    return await neteaseHotwords()
  } catch {
    // 降级：依次尝试其他源
    for (const fn of [neteaseHotwords, qqHotwords, kugouHotwords]) {
      try {
        const r = await fn()
        if (r.length) return r
      } catch { /* 继续 */ }
    }
    return []
  }
}

/** 搜索建议（酷狗/QQ 提供，网易降级到酷狗） */
export async function suggest(source: Source, keyword: string): Promise<string[]> {
  for (const fn of source === 'qq' ? [qqSuggest, kugouSuggest] : [kugouSuggest, qqSuggest]) {
    try {
      const r = await fn(keyword)
      if (r.length) return r
    } catch { /* 继续 */ }
  }
  return []
}

/** 推荐歌单（聚合三官方源，标注各自 source） */
export async function recommendAll(): Promise<PlaylistSummary[]> {
  const out: PlaylistSummary[] = []
  const tasks: Array<[Source, () => Promise<PlaylistSummary[]>]> = [
    ['wy', neteaseRecommend],
    ['qq', qqRecommend],
  ]
  for (const [, fn] of tasks) {
    try {
      const r = await fn()
      out.push(...r.slice(0, 10))
    } catch { /* 单源失败不影响其他 */ }
  }
  // 酷狗用 TOP500 兜底一条
  out.push({ id: '8888', name: '酷狗 TOP500', coverUrl: null, source: 'kg', playCount: 0, trackCount: 500 })
  return out
}

/** 榜单列表（聚合三官方源） */
export async function toplistsAll(): Promise<PlaylistSummary[]> {
  const out: PlaylistSummary[] = []
  for (const fn of [neteaseToplists, kugouToplists, qqToplists]) {
    try {
      out.push(...(await fn()))
    } catch { /* 单源失败不影响其他 */ }
  }
  return out
}

/** 按音源返回榜单（首页分段切换用） */
export async function toplistsBySource(source: Source): Promise<PlaylistSummary[]> {
  try {
    if (source === 'wy') return await neteaseToplists()
    if (source === 'kg') return await kugouToplists()
    return await qqToplists()
  } catch {
    return toplistsAll().then((all) => all.filter((p) => p.source === source))
  }
}

/** 取歌单/榜单歌曲：按 source + id 长度路由到对应官方源 */
export async function playlistSongs(source: Source, id: string): Promise<Song[]> {
  if (source === 'wy') return neteasePlaylistSongs(id)
  if (source === 'kg') {
    // 酷狗榜单 id 是数字、歌单可能是 hash；榜单详情接口用 rankid
    if (/^\d+$/.test(id)) return kugouToplistSongs(id)
    return []
  }
  // QQ：纯数字且 <6 位视为 topId，否则 disstid
  if (/^\d{1,5}$/.test(id)) return qqToplistSongs(id)
  return qqPlaylistSongs(id)
}
