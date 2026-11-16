import { Node, mergeAttributes } from '@tiptap/core'
import { InlineMath } from '@tiptap/extension-mathematics'
import { getClip, getJob, subscribeJobs } from '../../lib/clip'

// Where an equation clipped from a PDF came from. Stored with the note (not
// the image), so the clip can be redrawn and, later, shown in the PDF.
const sourceAttributes = {
  sourceResource: {
    default: null,
    parseHTML: el => el.getAttribute('data-source-resource'),
    renderHTML: a => (a.sourceResource ? { 'data-source-resource': a.sourceResource } : {}),
  },
  sourcePage: {
    default: null,
    parseHTML: el => (el.hasAttribute('data-source-page') ? +el.getAttribute('data-source-page') : null),
    renderHTML: a => (a.sourcePage ? { 'data-source-page': a.sourcePage } : {}),
  },
  sourceRect: {
    default: null,
    parseHTML: el => parseJson(el.getAttribute('data-source-rect')),
    renderHTML: a => (a.sourceRect ? { 'data-source-rect': JSON.stringify(a.sourceRect) } : {}),
  },
}

function parseJson(s) {
  try { return s ? JSON.parse(s) : null } catch { return null }
}

// Inline equations, plus the optional PDF source.
export const SourcedInlineMath = InlineMath.extend({
  addAttributes() {
    return { ...this.parent?.(), ...sourceAttributes }
  },
})

export const sourceAttrs = (clip) => ({
  sourceResource: clip.resourceId ?? null,
  sourcePage: clip.page,
  sourceRect: clip.rect,
})

// Position of the pending equation with this id, or null.
export function findPendingEquation(doc, id) {
  let found = null
  doc.descendants((node, pos) => {
    if (found !== null) return false
    if (node.type.name === 'pendingEquation' && node.attrs.id === id) found = pos
  })
  return found
}

// A clipped equation waiting to be converted to LaTeX: shows the clip with a
// status, and, if conversion failed or was interrupted, Retry / Type it.
// options.canRetry(attrs) → bool; onRetry(attrs); onType(attrs, pos, dom)
export const PendingEquation = Node.create({
  name: 'pendingEquation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { canRetry: () => false, onRetry: () => {}, onType: () => {} }
  },

  addAttributes() {
    return {
      id: { default: null, parseHTML: el => el.getAttribute('data-id'), renderHTML: a => ({ 'data-id': a.id }) },
      sourceResource: sourceAttributes.sourceResource,
      sourcePage: sourceAttributes.sourcePage,
      sourceRect: sourceAttributes.sourceRect,
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="pending-equation"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'pending-equation' })]
  },

  addNodeView() {
    const options = this.options
    return ({ node: initial, getPos }) => {
      let node = initial
      const dom = document.createElement('span')
      dom.className = 'pending-equation'
      dom.contentEditable = 'false'
      dom.dataset.type = 'pending-equation'

      const button = (label, onClick) => {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = 'pending-equation-action'
        b.textContent = label
        b.addEventListener('mousedown', e => e.preventDefault()) // keep editor selection
        b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); onClick() })
        return b
      }

      const render = () => {
        const { id, sourcePage } = node.attrs
        const clip = getClip(id)
        const job = getJob(id)
        dom.replaceChildren()
        if (clip?.thumb) {
          const img = document.createElement('img')
          img.src = clip.thumb
          img.alt = 'Clipped equation'
          img.className = 'pending-equation-image'
          img.draggable = false
          dom.append(img)
        }
        const status = document.createElement('span')
        status.className = 'pending-equation-status'
        if (job?.status === 'pending') {
          dom.dataset.state = 'pending'
          status.textContent = 'Reading equation…'
          status.setAttribute('role', 'status')
          dom.append(status)
          return
        }
        dom.dataset.state = 'failed'
        status.textContent = job?.message ?? (sourcePage ? `Equation from p. ${sourcePage}` : 'Equation')
        dom.append(status)
        if (options.canRetry(node.attrs)) dom.append(button('Retry', () => options.onRetry(node.attrs)))
        dom.append(button('Type it', () => options.onType(node.attrs, getPos(), dom)))
      }

      const unsubscribe = subscribeJobs(id => { if (id === null || id === node.attrs.id) render() })
      render()

      return {
        dom,
        update(next) {
          if (next.type !== node.type) return false
          node = next
          render()
          return true
        },
        stopEvent: e => !!e.target.closest?.('button'),
        ignoreMutation: () => true,
        destroy: unsubscribe,
      }
    }
  },
})
