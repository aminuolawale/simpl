// Plain-text preview of a TipTap/ProseMirror JSON document.
export function notePreview(content, max = 120) {
  if (!content?.content) return ''
  const texts = []
  const walk = (nodes) => {
    for (const n of nodes ?? []) {
      if (n.text) texts.push(n.text)
      if (n.content) walk(n.content)
    }
  }
  walk(content.content)
  const full = texts.join(' ')
  return full.length > max ? full.slice(0, max) + '…' : full
}

export const noteTitle = (note) => note?.title?.trim() || 'Untitled note'
