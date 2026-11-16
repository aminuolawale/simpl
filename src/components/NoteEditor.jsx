import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { supabase } from '../lib/supabase'
import { deleteNote } from '../lib/deletion'
import ConfirmDelete from './ConfirmDelete'
import styles from './NoteEditor.module.css'

const SAVE_DELAY = 1000

export default function NoteEditor({ sessionId, initialContent }) {
  const saveTimer = useRef(null)
  const statusRef = useRef(null)
  const inFlight = useRef(Promise.resolve())
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent ?? '',
    onUpdate: ({ editor }) => {
      clearTimeout(saveTimer.current)
      if (statusRef.current) statusRef.current.textContent = 'Saving…'
      saveTimer.current = setTimeout(() => {
        inFlight.current = (async () => {
          const { error } = await supabase.from('notes').upsert(
            { reading_session_id: sessionId, content: editor.getJSON(), updated_at: new Date().toISOString() },
            { onConflict: 'reading_session_id' }
          )
          if (statusRef.current) {
            statusRef.current.textContent = error ? 'Error saving' : 'Saved'
          }
        })()
      }, SAVE_DELAY)
    },
  })

  useEffect(() => () => clearTimeout(saveTimer.current), [])

  const removeNote = async () => {
    // Drop any pending autosave and let an in-progress one finish first,
    // so it can't recreate the note after we delete it.
    clearTimeout(saveTimer.current)
    await inFlight.current
    await deleteNote(supabase, sessionId)
    editor?.commands.setContent('', { emitUpdate: false })
    if (statusRef.current) statusRef.current.textContent = 'Deleted'
    setConfirmingDelete(false)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <button
          className={`${styles.btn} ${editor?.isActive('bold') ? styles.active : ''}`}
          onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleBold().run() }}
          title="Bold"
        >B</button>
        <button
          className={`${styles.btn} ${editor?.isActive('italic') ? styles.active : ''}`}
          onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleItalic().run() }}
          title="Italic"
        ><em>I</em></button>
        <button
          className={`${styles.btn} ${editor?.isActive('bulletList') ? styles.active : ''}`}
          onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleBulletList().run() }}
          title="Bullet list"
        >—</button>
        <span ref={statusRef} className={styles.status} />
        <button
          className={styles.deleteBtn}
          onClick={() => setConfirmingDelete(true)}
          title="Delete note"
        >Delete note</button>
      </div>
      <EditorContent editor={editor} className={styles.editor} />
      {confirmingDelete && (
        <ConfirmDelete
          title="Delete note"
          message="This session's note will be deleted. The session is kept."
          onConfirm={removeNote}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  )
}
