// sw.js — Service Worker for 一炁堂 PWA
const CACHE_NAME = 'yiqitang-v1'

// 缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
]

// 安装：预缓存核心资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// 激活：清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// 拦截请求：网络优先，失败时走缓存
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // API 请求：只走网络，不缓存（命盘数据不能离线）
  if (url.pathname.startsWith('/api/')) {
    return
  }

  // 静态资源：缓存优先
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached
      return fetch(event.request).then(response => {
        // 只缓存成功的 GET 请求
        if (
          response.ok &&
          event.request.method === 'GET' &&
          !url.pathname.startsWith('/api/')
        ) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      }).catch(() => {
        // 离线时，HTML 请求返回缓存的首页
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/')
        }
      })
    })
  )
})
