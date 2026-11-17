// Web 版下载：把音频存到 IndexedDB，并可导出为本地文件
// 对齐原生 DownloadManager 的"已下载"概念（Web 端持久化为浏览器 IndexedDB）

import { useState } from 'react'
import { api } from '../lib/api'
import type { Song } from '../lib/types'
import { songKey } from '../lib/types'
import { Sheet, toast, Icon } from '../components/common'

const DB_NAME = 'mymusic2-downloads'
const STORE = 'songs'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getDownloadedKeys(): Promise<Set<string>> {
  try {
    const db = await openDb()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAllKeys()
      req.onsuccess = () => resolve(new Set((req.result as string[]) || []))
      req.onerror = () => resolve(new Set())
    })
  } catch { return new Set() }
}

export async function saveDownload(song: Song, blob: Blob): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ key: songKey(song), song, blob, at: Date.now() })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function deleteDownload(key: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve()
  })
}

export async function getDownloadList(): Promise<Array<{ key: string; song: Song; blob: Blob }>> {
  try {
    const db = await openDb()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAll()
      req.onsuccess = () => resolve((req.result as any[]) || [])
      req.onerror = () => resolve([])
    })
  } catch { return [] }
}

export function DownloadSection({ song, onClose }: { song: Song; onClose: () => void }) {
  const [busy, setBusy] = useState(false)

  const doDownload = async (saveLocal: boolean) => {
    setBusy(true)
    try {
      toast('正在解析音频地址…')
      const url = await api.playUrl(song)
      toast('正在下载…')
      const res = await fetch(api.stream(url, song.source))
      if (!res.ok) throw new Error('下载失败')
      const blob = await res.blob()
      if (saveLocal) {
        await saveDownload(song, blob)
        toast('已下载到本地')
      } else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${song.name} - ${song.artist}.mp3`
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 10000)
        toast('已保存到设备')
      }
      onClose()
    } catch (e: any) {
      toast(e?.message || '下载失败，请稍后重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="下载歌曲" subtitle={`${song.name} - ${song.artist}`} onClose={onClose}>
      <p className="hint" style={{ marginBottom: 16 }}>
        Web 版可把歌曲缓存到浏览器本地（离线保留在"已下载"），或直接保存到设备文件。
      </p>
      <button className="btn block" disabled={busy} onClick={() => doDownload(true)}>
        {busy ? <span className="spinner small" /> : <Icon name="download" size={18} />} 缓存到本地（离线可用）
      </button>
      <button className="btn-outline block" style={{ marginTop: 12 }} disabled={busy} onClick={() => doDownload(false)}>
        保存为音频文件
      </button>
    </Sheet>
  )
}
