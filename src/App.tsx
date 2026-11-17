import { useEffect } from 'react'
import { Routes, Route, useLocation, NavLink, Navigate } from 'react-router-dom'
import { useSettings } from './store/useStore'
import { audioEngine } from './lib/audioEngine'
import { MiniPlayer } from './components/MiniPlayer'
import { ImageViewer, Icon } from './components/common'
import { useState } from 'react'
import Home from './pages/Home'
import Search from './pages/Search'
import Library from './pages/Library'
import PlayerPage from './pages/Player'
import PlaylistPage from './pages/Playlist'
import { TopLists, NewSongs, Recommend } from './pages/TopLists'
import SongList from './pages/SongList'
import MyPlaylistPage from './pages/MyPlaylist'
import Settings from './pages/Settings'
import Transfer from './pages/Transfer'

function BottomNav() {
  const loc = useLocation()
  // 二级页不显示底栏；只在顶层三页显示
  const topLevel = ['/', '/search', '/library'].includes(loc.pathname)
  if (!topLevel) return null
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
        <span className="nav-icon"><Icon name="home" size={20} /></span>
        <span>首页</span>
      </NavLink>
      <NavLink to="/search" className={({ isActive }) => isActive ? 'active' : ''}>
        <span className="nav-icon"><Icon name="search" size={20} /></span>
        <span>搜索</span>
      </NavLink>
      <NavLink to="/library" className={({ isActive }) => isActive ? 'active' : ''}>
        <span className="nav-icon"><Icon name="library" size={20} /></span>
        <span>音乐库</span>
      </NavLink>
    </nav>
  )
}

function ThemeSync() {
  const darkMode = useSettings((s) => s.darkMode)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = darkMode === 'dark' || (darkMode === 'system' && mq.matches)
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#141218' : '#D43C33')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [darkMode])
  return null
}

function GlobalImageViewer() {
  const [state, setState] = useState<{ url: string; title: string } | null>(null)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.url) setState(detail)
    }
    window.addEventListener('mm2-image', handler)
    return () => window.removeEventListener('mm2-image', handler)
  }, [])
  return state ? <ImageViewer url={state.url} title={state.title} onClose={() => setState(null)} /> : null
}

function Layout() {
  const loc = useLocation()
  const isPlayer = loc.pathname === '/player'
  return (
    <>
      <div className={`app-shell ${isPlayer ? 'player-route' : ''}`}>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/library" element={<Library />} />
            <Route path="/player" element={<PlayerPage />} />
            <Route path="/recommend" element={<Recommend />} />
            <Route path="/newsongs" element={<NewSongs />} />
            <Route path="/toplists/:source" element={<TopLists />} />
            <Route path="/playlist/:source/:id" element={<PlaylistPage />} />
            <Route path="/songlist/:type" element={<SongList />} />
            <Route path="/myplaylist/:id" element={<MyPlaylistPage />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/transfer/:mode" element={<Transfer />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        {!isPlayer && <MiniPlayer />}
        <BottomNav />
      </div>
      <GlobalImageViewer />
    </>
  )
}

export default function App() {
  useEffect(() => {
    audioEngine.init()
  }, [])
  return (
    <>
      <ThemeSync />
      <Layout />
    </>
  )
}
