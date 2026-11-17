// HTTP 工具：Worker 环境用 fetch，手动处理 302、表单、JSON、KG_TAG 剥离等

import { USER_AGENT } from './config'

export async function getText(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = 20000
): Promise<string> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, ...headers },
      redirect: 'follow',
      signal: ctl.signal,
    })
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

export async function postForm(
  url: string,
  form: Record<string, string>,
  headers: Record<string, string> = {},
  timeoutMs = 30000
): Promise<string> {
  const body = Object.keys(form)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(form[k] ?? '')}`)
    .join('&')
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        ...headers,
      },
      body,
      redirect: 'follow',
      signal: ctl.signal,
    })
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

export async function postJson(
  url: string,
  jsonBody: unknown,
  headers: Record<string, string> = {},
  timeoutMs = 20000
): Promise<string> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json; charset=UTF-8',
        ...headers,
      },
      body: JSON.stringify(jsonBody),
      redirect: 'follow',
      signal: ctl.signal,
    })
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

/** 读取 302 的 Location（禁用自动重定向），相对路径解析成绝对地址 */
export async function getRedirectLocation(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = 20000
): Promise<string> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, ...headers },
      redirect: 'manual',
      signal: ctl.signal,
    })
    let loc = res.headers.get('Location')
    if (!loc && res.status >= 200 && res.status < 300) {
      // 2xx 无 Location：可能是上游直接给了直链（文本）
      const text = (await res.text()).trim()
      if (/^https?:\/\//.test(text)) return text
      throw new Error('上游未返回重定向地址（签名可能过期）')
    }
    if (!loc) throw new Error('上游未返回重定向地址')
    if (loc.startsWith('//')) loc = 'https:' + loc
    else if (loc.startsWith('/')) loc = new URL(loc, url).toString()
    return loc
  } finally {
    clearTimeout(timer)
  }
}

/** 酷狗榜单接口返回被 <!--KG_TAG_RES_START--> ... <!--KG_TAG_RES_END--> 包裹 */
export function stripKgTag(s: string): string {
  let out = s
  const start = out.indexOf('-->\n')
  const firstGt = out.indexOf('>')
  if (out.includes('KG_TAG_RES_START')) {
    const i = out.indexOf('-->', out.indexOf('KG_TAG_RES_START'))
    out = i >= 0 ? out.slice(i + 3) : out
  }
  if (out.includes('KG_TAG_RES_END')) {
    out = out.slice(0, out.indexOf('KG_TAG_RES_END'))
  }
  // 兜底：截取第一个 { 到最后一个 }
  const lb = out.indexOf('{')
  const rb = out.lastIndexOf('}')
  if (lb >= 0 && rb > lb) out = out.slice(lb, rb + 1)
  void start
  void firstGt
  return out.trim()
}

export function tryParseJson<T = any>(s: string): T | null {
  try {
    return JSON.parse(s) as T
  } catch {
    return null
  }
}

export function safeNumber(v: unknown, def = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

export function firstNonEmpty(...vals: unknown[]): string {
  for (const v of vals) {
    if (v != null && String(v).trim() !== '') return String(v)
  }
  return ''
}

/** 去掉空白字符（含全角空格），对齐 SvipProvider.searchKeyword */
export function cleanKeyword(raw: string): string {
  if (!raw) return ''
  let out = ''
  for (const c of raw) if (!/\s/.test(c)) out += c
  return out || raw.trim()
}
