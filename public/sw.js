// MyMusic2 Web · Service Worker
// 作用：① 让浏览器可安装（PWA）② 缓存应用外壳，弱网/二次打开更快
// 策略：静态资源 cache-first；/api 数据 network-first（失败回缓存）；/api/stream 音频流直连不缓存
const CACHE = 'mymusic2-v1'

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // 第三方封面 CDN 交给浏览器

  // 音频流/取链/取封面：必须实时，绝不缓存（音频流还是 Range 分片，缓存没意义）
  if (url.pathname.startsWith('/api/stream') || url.pathname.startsWith('/api/url') || url.pathname.startsWith('/api/pic')) return

  // 页面导航：network-first，失败回退应用外壳（配合前端 history 路由）
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/index.html', copy))
          return res
        })
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // 其余 /api：network-first，断网时回最近一次结果
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
          return res
        })
        .catch(() => caches.match(req))
    )
    return
  }

  // 静态资源（带 hash 的 bundle、图标等）：cache-first
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone()
      caches.open(CACHE).then((c) => c.put(req, copy))
      return res
    }))
  )
})
