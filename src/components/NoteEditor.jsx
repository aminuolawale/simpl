import { useEffect, useRef, useState } from 'react'
import { useEditor, useEditorState, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import 'katex/dist/katex.min.css'
import { AtMenu } from './editor/atMenu'
import AtMenuList from './editor/AtMenuList'
import EquationPopup, { renderLatex } from './editor/EquationPopup'
import { SourcedInlineMath, PendingEquation, findPendingEquation, sourceAttrs } from './editor/equationClips'
import { CLIP_MIME, convertClip, getClip, makeClip, newId, putClip, refreshJobs, setClipTarget, setJob } from '../lib/clip'
import { usePdf } from '../context/PdfContext'
import { supabase } from '../lib/supabase'
import { deleteNote } from '../lib/deletion'
import { currentUserId } from '../lib/resources'
import ConfirmDelete from './ConfirmDelete'
import styles from './NoteEditor.module.css'

const SAVE_DELAY = 1000

// Alignment icons: four lines, shortened on the side away from the alignment.
function AlignIcon({ align }) {
  const x = (w) => (align === 'left' ? 0 : align === 'right' ? 14 - w : (14 - w) / 2)
  return (
    <svg width="14" height="11" viewBox="0 0 14 11" fill="none" aria-hidden="true">
      {[14, 9, 14, 9].map((w, i) => (
        <line key={i} x1={x(w)} x2={x(w) + w} y1={0.5 + i * 3.3} y2={0.5 + i * 3.3} stroke="currentColor" strokeWidth="1" />
      ))}
    </svg>
  )
}

// Toolbar buttons, in order. `null` draws a separator. A tool is highlighted
// when `active(editor)` is true, or else when `name`/`attrs` are active.
const TOOLS = [
  { name: 'bold', label: <b>B</b>, title: 'Bold (⌘B)', run: c => c.toggleBold() },
  { name: 'italic', label: <em>I</em>, title: 'Italic (⌘I)', run: c => c.toggleItalic() },
  null,
  ...[1, 2, 3].map(level => ({
    name: 'heading', attrs: { level }, label: `H${level}`, title: `Heading ${level}`,
    run: c => c.toggleHeading({ level }),
  })),
  null,
  { name: 'bulletList', label: '•', title: 'Bulleted list', run: c => c.toggleBulletList() },
  { name: 'orderedList', label: '1.', title: 'Numbered list', run: c => c.toggleOrderedList() },
  null,
  {
    label: <AlignIcon align="left" />, title: 'Align left (⌘⇧L)',
    // Left is the default, so it clears any alignment rather than storing one.
    active: e => !e.isActive({ textAlign: 'center' }) && !e.isActive({ textAlign: 'right' }),
    run: c => c.unsetTextAlign(),
  },
  { attrs: { textAlign: 'center' }, label: <AlignIcon align="center" />, title: 'Align center (⌘⇧E)', run: c => c.setTextAlign('center') },
  { attrs: { textAlign: 'right' }, label: <AlignIcon align="right" />, title: 'Align right (⌘⇧R)', run: c => c.setTextAlign('right') },
]

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

  // @ menu: { items, rect, command } while open; `menuIndex` is the highlighted item.
  const [menu, setMenu] = useState(null)
  const [menuIndex, setMenuIndex] = useState(0)
  const menuRef = useRef({ menu: null, index: 0 })
  menuRef.current = { menu, index: menuIndex }
  // Equation popup: { pos, initial, editing, rect, image?, pending? } while open.
  // `pending` holds a placeholder's attrs when typing in place of a clip.
  const [equation, setEquation] = useState(null)
  const editorRef = useRef(null)
  // The PDF beside the note, for redrawing clips after a reload.
  const { pdfDoc, docId } = usePdf()
  const pdfRef = useRef({ pdfDoc, docId })
  pdfRef.current = { pdfDoc, docId }
  // Clip handlers; extensions call them through this ref.
  const clipActions = useRef({})

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

  // ── equations clipped from the PDF ─────────────────────────────────────────

  // Convert a clip and swap its placeholder for the equation. Uncertain
  // results open the equation popup for review.
  const convert = async (clip) => {
    setJob(clip.id, { status: 'pending' })
    let result
    try {
      result = await convertClip(clip)
    } catch (e) {
      setJob(clip.id, { status: 'failed', message: e.message })
      return
    }
    setJob(clip.id, null)
    const ed = editorRef.current
    if (!ed || ed.isDestroyed) return
    const pos = findPendingEquation(ed.state.doc, clip.id)
    if (pos === null) return // the placeholder was deleted meanwhile
    const latex = result.latex.trim()
    const math = ed.schema.nodes.inlineMath.create({ latex: latex || '?', ...sourceAttrs(clip) })
    // Not a separate undo step: undoing the drop removes the equation.
    ed.view.dispatch(ed.state.tr.replaceWith(pos, pos + 1, math).setMeta('addToHistory', false))
    if (!latex || !result.legible || renderLatex(latex).error) {
      const dom = ed.view.nodeDOM(pos)
      setEquation({ pos, initial: latex, editing: true, rect: dom?.getBoundingClientRect(), image: clip.thumb, uncertain: true })
    }
  }

  // Defined before the editor is created: a note saved with a placeholder
  // draws it (and asks canRetry) during the editor's first render.
  clipActions.current = {
    // Put a placeholder for the clip at `pos` and start converting it.
    insert: (clip, pos) => {
      const editor = editorRef.current
      if (!editor || editor.isDestroyed) return
      // A fresh id per insertion, so the same clip can be dropped twice.
      const placed = putClip({ ...clip, id: newId() })
      editor.chain().focus()
        .insertContentAt(pos, { type: 'pendingEquation', attrs: { id: placed.id, ...sourceAttrs(placed) } })
        .run()
      convert(placed)
    },
    // Retry works while the clip is in memory, or its PDF is open to redraw it.
    canRetry: (attrs) => !!getClip(attrs.id) ||
      (!!pdfRef.current.pdfDoc && !!attrs.sourceResource && attrs.sourceResource === pdfRef.current.docId),
    retry: async (attrs) => {
      let clip = getClip(attrs.id)
      if (!clip) {
        setJob(attrs.id, { status: 'pending' })
        try {
          clip = await makeClip(pdfRef.current.pdfDoc, {
            id: attrs.id, resourceId: attrs.sourceResource, page: attrs.sourcePage, rect: attrs.sourceRect,
          })
        } catch {
          setJob(attrs.id, { status: 'failed', message: 'Couldn’t redraw the clip' })
          return
        }
      }
      convert(clip)
    },
    typeInstead: (attrs, pos, dom) => {
      setEquation({ pos, initial: '', editing: false, rect: dom.getBoundingClientRect(), image: getClip(attrs.id)?.thumb, pending: attrs })
    },
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right'] }),
      SourcedInlineMath.configure({
        katexOptions: { throwOnError: false },
        // Click an equation to edit it.
        onClick: (node, pos) => {
          const dom = editorRef.current?.view.nodeDOM(pos)
          if (!dom) return
          setEquation({ pos, initial: node.attrs.latex, editing: true, rect: dom.getBoundingClientRect() })
        },
      }),
      PendingEquation.configure({
        canRetry: (attrs) => clipActions.current.canRetry(attrs),
        onRetry: (attrs) => clipActions.current.retry(attrs),
        onType: (attrs, pos, dom) => clipActions.current.typeInstead(attrs, pos, dom),
      }),
      AtMenu.configure({
        onChange: (props) => {
          if (!props) { setMenu(null); return }
          setMenu({ items: props.items, rect: props.clientRect?.(), command: props.command })
          if (props.items !== menuRef.current.menu?.items) setMenuIndex(0)
        },
        onKeyDown: (event) => {
          const { menu, index } = menuRef.current
          if (!menu || menu.items.length === 0) return false
          const n = menu.items.length
          if (event.key === 'ArrowDown') { setMenuIndex((index + 1) % n); return true }
          if (event.key === 'ArrowUp') { setMenuIndex((index - 1 + n) % n); return true }
          if (event.key === 'Enter' || event.key === 'Tab') { menu.command(menu.items[index]); return true }
          if (event.key === 'Escape') { setMenu(null); return true }
          return false
        },
        onSelect: (item, pos) => {
          if (item.id === 'equation') {
            const rect = editorRef.current?.view.coordsAtPos(pos)
            setEquation({ pos, initial: '', editing: false, rect })
          }
        },
      }),
    ],
    content: initialContent ?? '',
    editorProps: {
      // Equations dragged in from the PDF.
      handleDrop: (view, event) => {
        if (!event.dataTransfer?.types.includes(CLIP_MIME)) return false
        const clip = getClip(event.dataTransfer.getData(CLIP_MIME))
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })
        if (clip && at) clipActions.current.insert(clip, at.pos)
        return true
      },
    },
    onUpdate: ({ editor }) => {
      clearTimeout(saveTimer.current)
      setStatus('Saving…')
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null
        save(editor.getJSON())
      }, SAVE_DELAY)
    },
  })

  editorRef.current = editor

  // Whether a placeholder can be retried depends on the PDF beside the note,
  // which usually loads after it: redraw placeholders when that changes.
  useEffect(() => { refreshJobs() }, [pdfDoc, docId])

  // Offer this editor as the place "Insert" sends clips (at the cursor).
  useEffect(() => {
    if (!editor) return
    return setClipTarget({ insert: (clip) => clipActions.current.insert(clip, editor.state.selection.to) })
  }, [editor])

  const closeEquation = () => {
    const pos = equation?.pos
    setEquation(null)
    if (editor && pos != null) editor.chain().focus().setTextSelection(pos + (equation.editing || equation.pending ? 1 : 0)).run()
  }

  const submitEquation = (latex) => {
    const { pos, editing, pending } = equation
    setEquation(null)
    if (!editor) return
    const chain = editor.chain().focus()
    if (pending) {
      // Typed in place of a clip: replace the placeholder.
      if (!latex) { chain.setTextSelection(pos + 1).run(); return }
      chain.insertContentAt({ from: pos, to: pos + 1 }, { type: 'inlineMath', attrs: { latex, ...sourceAttrsFromPending(pending) } })
        .setTextSelection(pos + 1).run()
      setJob(pending.id, null)
    } else if (editing && !latex) {
      chain.deleteInlineMath({ pos }).setTextSelection(pos).run()
    } else if (editing) {
      chain.updateInlineMath({ latex, pos }).setTextSelection(pos + 1).run()
    } else if (latex) {
      chain.insertInlineMath({ latex, pos }).setTextSelection(pos + 1).run()
    } else {
      chain.setTextSelection(pos).run()
    }
  }

  // Re-read which formats are active whenever the selection or content changes.
  const active = useEditorState({
    editor,
    selector: ({ editor }) => TOOLS.map(t => !!t && !!editor &&
      (t.active ? t.active(editor) : t.name ? editor.isActive(t.name, t.attrs) : editor.isActive(t.attrs))),
  }) ?? []

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
        {TOOLS.map((t, i) => t ? (
          <button
            key={i}
            className={`${styles.btn} ${active[i] ? styles.active : ''}`}
            onMouseDown={e => { e.preventDefault(); editor && t.run(editor.chain().focus()).run() }}
            title={t.title}
            aria-label={t.title}
            aria-pressed={!!active[i]}
          >{t.label}</button>
        ) : <span key={i} className={styles.toolSep} />)}
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
      {menu && (
        <AtMenuList
          items={menu.items}
          index={menuIndex}
          rect={menu.rect}
          onHover={setMenuIndex}
          onChoose={item => menu.command(item)}
        />
      )}
      {equation?.rect && (
        <EquationPopup
          key={`${equation.pos}-${equation.editing}`}
          initial={equation.initial}
          editing={equation.editing}
          image={equation.image}
          uncertain={equation.uncertain}
          rect={equation.rect}
          onSubmit={submitEquation}
          onCancel={closeEquation}
        />
      )}
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

const sourceAttrsFromPending = (a) => ({
  sourceResource: a.sourceResource, sourcePage: a.sourcePage, sourceRect: a.sourceRect,
})
