import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePlayer, useLibrary } from '../store/useStore'
import type { Song } from '../lib/types'
import { TopBar, SongRow, LikeButton, EmptyBox, toast, Dialog, Sheet, Icon } from '../components/common'
import { encodePlaylist } from '../lib/utils'

export default function MyPlaylistPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const pid = Number(id)
  const playlists = useLibrary((s) => s.playlists)
  const playlist = playlists.find((p) => p.id === pid)
  const renamePlaylist = useLibrary((s) => s.renamePlaylist)
  const deletePlaylist = useLibrary((s) => s.deletePlaylist)
  const removeFromPlaylist = useLibrary((s) => s.removeFromPlaylist)
  const playingKey = usePlayer((s) => {
    const song = s.queue[s.currentIndex]
    return song ? `${song.source}_${song.id}` : ''
  })
  const [showRename, setShowRename] = useState(false)
  const [newName, setNewName] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [shareText, setShareText] = useState<string | null>(null)

  if (!playlist) {
    return <div className="page"><TopBar title="歌单" onBack={() => nav(-1)} /><EmptyBox text="歌单已删除" /></div>
  }

  const songs = playlist.songs

  const share = async () => {
    if (!songs.length) { toast('没有可分享的歌曲'); return }
    const text = await encodePlaylist(songs)
    setShareText(text)
    setShowMore(false)
  }

  return (
    <div className="page">
      <TopBar title={playlist.name} onBack={() => nav(-1)} actions={
        <button className="icon-btn" onClick={() => setShowMore(true)} aria-label="更多"><Icon name="more" /></button>
      } />
      <div className="scroll-area">
        {songs.length === 0 ? (
          <EmptyBox text={'歌单还没有歌曲\n在「我的收藏」多选歌曲，点「加入歌单」即可'} />
        ) : (
          <>
            <div className="play-all-row" onClick={() => { usePlayer.getState().playAll(songs, 0); nav('/player') }}>
              <Icon name="play" size={26} />
              <span>播放全部（{songs.length}）</span>
            </div>
            <div className="song-list">
              {songs.map((song, i) => (
                <SongRow key={`${song.source}_${song.id}_${i}`} song={song}
                  active={playingKey === `${song.source}_${song.id}`}
                  trailing={<button className="icon-btn small" onClick={() => { removeFromPlaylist(pid, song); toast('已从歌单移除') }} aria-label="从歌单移除"><Icon name="close" size={18} /></button>}
                  onPlay={() => { usePlayer.getState().playAll(songs, i); nav('/player') }} />
              ))}
            </div>
          </>
        )}
      </div>

      {showMore && (
        <Sheet title="更多操作" onClose={() => setShowMore(false)}>
          <button className="menu-item" onClick={share}><Icon name="share" size={20} />分享歌单</button>
          <button className="menu-item" onClick={() => { setNewName(playlist.name); setShowRename(true); setShowMore(false) }}><Icon name="note" size={20} />重命名</button>
          <button className="menu-item danger" onClick={() => { setShowDelete(true); setShowMore(false) }}><Icon name="delete" size={20} />删除歌单</button>
        </Sheet>
      )}
      {showRename && (
        <Dialog title="重命名歌单" confirmText="确定"
          content={<input className="dialog-input" maxLength={30} autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} />}
          onClose={() => setShowRename(false)}
          onConfirm={() => { if (newName.trim()) { renamePlaylist(pid, newName.trim()); toast('已重命名') } setShowRename(false) }} />
      )}
      {showDelete && (
        <Dialog title="删除歌单" danger confirmText="删除"
          content={<p>将删除《{playlist.name}》及其全部 {songs.length} 首歌曲，歌曲本身（收藏/下载）不受影响。</p>}
          onClose={() => setShowDelete(false)}
          onConfirm={() => { deletePlaylist(pid); toast('歌单已删除'); setShowDelete(false); nav(-1) }} />
      )}
      {shareText !== null && (
        <Sheet title={`分享 ${songs.length} 首歌曲`} onClose={() => setShareText(null)}>
          <p className="hint">复制下方文本，在其他设备的「导入歌单」中粘贴即可导入。</p>
          <textarea className="share-text" readOnly value={shareText} />
          <button className="btn block" onClick={() => { navigator.clipboard?.writeText(shareText); toast('已复制') }}>复制文本</button>
        </Sheet>
      )}
    </div>
  )
}
