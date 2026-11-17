import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLibrary, usePlayer } from '../store/useStore'
import { TopBar, Icon, Cover, SongRow, SectionHeader, HeaderAction, Dialog, toast } from '../components/common'

export default function Library() {
  const nav = useNavigate()
  const likedSongs = useLibrary((s) => s.likedSongs)
  const recentSongs = useLibrary((s) => s.recentSongs)
  const playlists = useLibrary((s) => s.playlists)
  const nickname = useLibrary((s) => s.nickname)
  const avatar = useLibrary((s) => s.avatar)
  const createPlaylist = useLibrary((s) => s.createPlaylist)
  const deletePlaylist = useLibrary((s) => s.deletePlaylist)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [toDelete, setToDelete] = useState<number | null>(null)

  const deleteTarget = playlists.find((p) => p.id === toDelete)

  return (
    <div className="page">
      <TopBar title="音乐库" actions={
        <button className="icon-btn" onClick={() => nav('/settings')} aria-label="设置"><Icon name="settings" /></button>
      } />
      <div className="scroll-area">
        {/* 个人信息 */}
        <div className="profile-header" onClick={() => nav('/settings')}>
          <div className="avatar">
            {avatar ? <img src={avatar} alt="头像" /> : <Icon name="person" size={32} />}
          </div>
          <div className="profile-name">{nickname || '未设置昵称'}</div>
          <Icon name="chevron" size={18} />
        </div>

        {/* 三个入口 */}
        <div className="library-entries">
          <Entry icon="liked" label="我的收藏" count={likedSongs.length} onClick={() => nav('/songlist/liked')} />
          <Entry icon="download" label="已下载" count={0} onClick={() => nav('/songlist/downloaded')} />
          <Entry icon="history" label="最近播放" count={recentSongs.length} onClick={() => nav('/songlist/recent')} />
        </div>

        {/* 我的歌单 */}
        <SectionHeader title="我的歌单" action={<HeaderAction text="新建" onClick={() => setShowCreate(true)} />} />
        {playlists.length === 0 ? (
          <div className="empty-guide" onClick={() => setShowCreate(true)}>
            <Icon name="folder" size={30} />
            <span>新建歌单，把喜欢的歌整理起来</span>
          </div>
        ) : playlists.map((p) => (
          <div key={p.id} className="list-row" onClick={() => nav(`/myplaylist/${p.id}`)}>
            <Cover url={p.songs[0]?.pic} size={44} corner={8} />
            <div className="song-info">
              <div className="song-name">{p.name}</div>
              <div className="song-sub">{p.songs.length} 首</div>
            </div>
            <button className="icon-btn small" onClick={(e) => { e.stopPropagation(); setToDelete(p.id) }} aria-label="删除歌单"><Icon name="delete" size={18} /></button>
            <span className="chevron"><Icon name="chevron" size={18} /></span>
          </div>
        ))}

        {/* 最近播放预览 */}
        <SectionHeader title="最近播放" action={recentSongs.length > 5 ? <HeaderAction text="更多" onClick={() => nav('/songlist/recent')} /> : undefined} />
        {recentSongs.length === 0 ? (
          <div className="hint" style={{ padding: '24px 16px' }}>还没有播放记录</div>
        ) : (
          <div className="song-list">
            {recentSongs.slice(0, 5).map((song, i) => (
              <SongRow key={`${song.source}_${song.id}_${i}`} song={song}
                onPlay={() => { usePlayer.getState().playAll(recentSongs, i); nav('/player') }} />
            ))}
          </div>
        )}
        <div style={{ height: 16 }} />
      </div>

      {showCreate && (
        <Dialog title="新建歌单" confirmText="创建"
          content={
            <input className="dialog-input" placeholder="歌单名" maxLength={30} autoFocus
              value={newName} onChange={(e) => setNewName(e.target.value)} />
          }
          onClose={() => { setShowCreate(false); setNewName('') }}
          onConfirm={() => {
            if (!newName.trim()) { toast('请输入歌单名'); return }
            const pl = createPlaylist(newName.trim())
            toast(`已创建《${pl.name}》`)
            setShowCreate(false); setNewName('')
          }} />
      )}
      {toDelete !== null && deleteTarget && (
        <Dialog title="删除歌单" danger confirmText="删除"
          content={<p>将删除《{deleteTarget.name}》及其全部 {deleteTarget.songs.length} 首歌曲，歌曲本身（收藏/下载）不受影响。</p>}
          onClose={() => setToDelete(null)}
          onConfirm={() => { deletePlaylist(toDelete); toast(`已删除《${deleteTarget.name}》`); setToDelete(null) }} />
      )}
    </div>
  )
}

function Entry({ icon, label, count, onClick }: { icon: string; label: string; count: number; onClick: () => void }) {
  return (
    <div className="library-entry" onClick={onClick}>
      <span className="entry-icon"><Icon name={icon} size={22} /></span>
      <span className="entry-label">{label}</span>
      <span className="entry-count">{count} 首</span>
      <Icon name="chevron" size={18} />
    </div>
  )
}

