import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { supabase } from '../lib/supabase'
import { deleteNote } from '../lib/deletion'
import { currentUserId } from '../lib/resources'
import ConfirmDelete from './ConfirmDelete'
import styles from './NoteEditor.module.css'

const SAVE_DELAY = 1000

// Autosaving rich-text note. Saves by note id; if there is no note yet
// (`noteId` null), the first edit inserts one using the `newNote` columns,
// e.g. { reading_session_id, resource_id }.
// `deletable` shows a "Delete note" button that clears the editor afterwards.
export default function NoteEditor({ noteId = null, initialContent, newNote = {}, deletable = false, onCreated }) {
  const saveTimer = useRef(null)
  const statusRef = useRef(null)
  const idRef = useRef(noteId)
  const queue = useRef(Promise.resolve()) // saves run one at a time, in order
  const latest = useRef({ newNote, onCreated })
  latest.current = { newNote, onCreated }
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const setStatus = (text) => { if (statusRef.current) statusRef.current.textContent = text }

  const save = (content) => {
    queue.current = queue.current.then(async () => {
      const updated_at = new Date().toISOString()
      let error
      if (idRef.current) {
        ({ error } = await supabase.from('notes').update({ content, updated_at }).eq('id', idRef.current))
      } else {
        const user_id = await currentUserId(supabase)
        let data
        ;({ data, error } = await supabase
          .from('notes')
          .insert({ ...latest.current.newNote, user_id, content, updated_at })
          .select('id')
          .single())
        if (data) {
          idRef.current = data.id
          latest.current.onCreated?.(data.id)
        }
      }
      setStatus(error ? 'Error saving' : 'Saved')
    })
    return queue.current
  }

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent ?? '',
    onUpdate: ({ editor }) => {
      clearTimeout(saveTimer.current)
      setStatus('Saving…')
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null
        save(editor.getJSON())
      }, SAVE_DELAY)
    },
  })

  // Flush a pending save when leaving the page so the last edits aren't lost.
  useEffect(() => () => {
    if (saveTimer.current && editor) {
      clearTimeout(saveTimer.current)
      save(editor.getJSON())
    }
  }, [editor])

  const removeNote = async () => {
    // Drop any pending autosave and let in-progress ones finish first,
    // so they can't recreate the note after we delete it.
    clearTimeout(saveTimer.current)
    saveTimer.current = null
    await queue.current
    if (idRef.current) await deleteNote(supabase, idRef.current)
    idRef.current = null
    editor?.commands.setContent('', { emitUpdate: false })
    setStatus('Deleted')
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
        {deletable && (
          <button
            className={styles.deleteBtn}
            onClick={() => setConfirmingDelete(true)}
            title="Delete note"
          >Delete note</button>
        )}
      </div>
      <EditorContent editor={editor} className={styles.editor} />
      {confirmingDelete && (
        <ConfirmDelete
          title="Delete note"
          message="This note will be deleted. The session is kept."
          onConfirm={removeNote}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  )
}
