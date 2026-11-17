// Cloudflare Pages Functions：API 代理总入口
// 前端所有 /api/* 请求经此转发到第三方音源，解决浏览器 CORS / Referer / 302 / 明文 HTTP 问题

import { search, resolveWithParams } from './_lib/svip'
import {
  hotwords,
  suggest,
  recommendAll,
  toplistsAll,
  toplistsBySource,
  playlistSongs,
} from './_lib/official'
import { playbackHeaders, USER_AGENT } from './_lib/config'
import { type Song, type Source, SOURCES } from './_lib/types'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': '*',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store', ...CORS },
  })
}

function err(message: string, status = 500): Response {
  return json({ error: message }, status)
}

function q(url: URL, key: string): string {
  return url.searchParams.get(key) || ''
}

function validSource(v: string): v is Source {
  return (SOURCES as readonly string[]).includes(v)
}

export async function onRequest(context: { request: Request }): Promise<Response> {
  const { request } = context
  const url = new URL(request.url)

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  try {
    switch (url.pathname) {
      // ---- 聚合源：搜索 ----
      case '/api/search': {
        const keyword = q(url, 'keyword')
        const source = q(url, 'source') || 'wy'
        const page = Number(q(url, 'page') || 1)
        if (!keyword) return err('缺少关键词', 400)
        if (!validSource(source)) return err('无效音源', 400)
        const result = await search(keyword, source, page)
        return json(result)
      }

      // ---- 聚合源：歌词 ----
      case '/api/lrc': {
        const source = q(url, 'source') || 'wy'
        const id = q(url, 'id')
        const name = q(url, 'name')
        const params = q(url, 'params')
        if (!id) return err('缺少歌曲 id', 400)
        const song = { id, name, artist: q(url, 'artist'), source }
        const lrc = await resolveWithParams('lrc', song, params)
        return new Response(lrc, {
          headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'public, max-age=3600', ...CORS },
        })
      }

      // ---- 官方源：热搜词 ----
      case '/api/hotwords': {
        const source = q(url, 'source') || 'wy'
        return json({ words: await hotwords(validSource(source) ? source : 'wy') })
      }

      // ---- 官方源：搜索建议 ----
      case '/api/suggest': {
        const keyword = q(url, 'keyword')
        const source = q(url, 'source') || 'wy'
        if (!keyword) return json({ words: [] })
        return json({ words: await suggest(validSource(source) ? source : 'wy', keyword) })
      }

      // ---- 官方源：推荐歌单（聚合） ----
      case '/api/recommend': {
        return json({ playlists: await recommendAll() })
      }

      // ---- 官方源：新歌速递（网易） ----
      case '/api/newsongs': {
        // 复用聚合模块内部无导出，这里通过 playlistSongs 拿不到；单独实现在 official 的导出行
        const { newsongs } = await import('./_lib/official')
        return json({ songs: await newsongs() })
      }

      // ---- 官方源：榜单列表 ----
      case '/api/toplists': {
        const source = q(url, 'source')
        if (source && validSource(source)) return json({ playlists: await toplistsBySource(source) })
        return json({ playlists: await toplistsAll() })
      }

      // ---- 官方源：歌单/榜单歌曲 ----
      case '/api/playlist': {
        const source = q(url, 'source') || 'wy'
        const id = q(url, 'id')
        if (!id) return err('缺少歌单 id', 400)
        if (!validSource(source)) return err('无效音源', 400)
        const songs = await playlistSongs(source, id)
        return json({ songs })
      }

      // ---- 音频流代理：取真实音频直链（302）----
      // 前端拿 song + params 调此接口，Worker 解析 302 后回传直链 URL 给 <audio> 使用
      case '/api/url': {
        const source = q(url, 'source') || 'wy'
        const id = q(url, 'id')
        const params = q(url, 'params')
        const name = q(url, 'name')
        if (!id) return err('缺少歌曲 id', 400)
        const song = { id, name, artist: q(url, 'artist'), source }
        const realUrl = await resolveWithParams('url', song, params)
        return json({ url: realUrl })
      }

      // ---- 封面代理：取封面真实直链（302）----
      case '/api/pic': {
        const source = q(url, 'source') || 'wy'
        const id = q(url, 'id')
        const params = q(url, 'params')
        if (!id) return err('缺少歌曲 id', 400)
        const song = { id, name: q(url, 'name'), artist: q(url, 'artist'), source }
        const realUrl = await resolveWithParams('pic', song, params)
        return json({ url: realUrl })
      }

      // ---- 通用二进制代理：把外部音频/图片流透传给浏览器 ----
      // 解决：① 音频 CDN 必须带 Referer；② 酷狗明文 HTTP 的 Mixed Content；③ CORS
      case '/api/stream': {
        const target = q(url, 'url')
        if (!target || !/^https?:\/\//.test(target)) return err('无效的目标地址', 400)
        const source = q(url, 'source') || ''
        const headers: Record<string, string> = {
          'User-Agent': USER_AGENT,
          ...playbackHeaders(source),
        }
        // 透传 Range 头，支持拖动进度（音频分片）
        const range = request.headers.get('Range')
        if (range) headers['Range'] = range
        const upstream = await fetch(target, { headers, redirect: 'follow' })
        const outHeaders = new Headers({
          'Content-Type': upstream.headers.get('Content-Type') || 'application/octet-stream',
          'Cache-Control': 'public, max-age=86400',
          ...CORS,
        })
        const cl = upstream.headers.get('Content-Length')
        if (cl) outHeaders.set('Content-Length', cl)
        const cr = upstream.headers.get('Content-Range')
        if (cr) outHeaders.set('Content-Range', cr)
        outHeaders.set('Accept-Ranges', upstream.headers.get('Accept-Ranges') || 'bytes')
        return new Response(upstream.body, { status: upstream.status, headers: outHeaders })
      }

      // ---- 随机头像（对齐 xxapi）----
      case '/api/randomavatar': {
        const upstream = await fetch('https://v2.xxapi.cn/api/head?return=json', {
          headers: { 'User-Agent': USER_AGENT },
        })
        const data: any = await upstream.json()
        const avatar = data?.data?.url || data?.data || data?.url || ''
        return json({ url: String(avatar) })
      }

      default:
        return err('未知接口', 404)
    }
  } catch (e: any) {
    return err(e?.message || '服务内部错误', 500)
  }
}
