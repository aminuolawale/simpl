import * as pdfjsLib from 'pdfjs-dist'

export async function extractOutline(file) {
  const ab = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise
  const raw = await pdf.getOutline()
  if (!raw) return []
  const resolved = await Promise.all(raw.map(async function walk(item) {
    let pageNumber = null
    try {
      let dest = item.dest
      if (typeof dest === 'string') dest = await pdf.getDestination(dest)
      if (Array.isArray(dest) && dest[0]) pageNumber = (await pdf.getPageIndex(dest[0])) + 1
    } catch {}
    return { title: item.title, pageNumber, items: await Promise.all((item.items || []).map(walk)) }
  }))
  return resolved
}
