import pdfjsLib from './pdfjs'

// The document outline as [{ title, pageNumber, items }], with destinations
// resolved to 1-based page numbers (null when one can't be resolved).
export async function readOutline(pdf) {
  const raw = await pdf.getOutline()
  if (!raw) return []
  return Promise.all(raw.map(async function walk(item) {
    let pageNumber = null
    try {
      let dest = item.dest
      if (typeof dest === 'string') dest = await pdf.getDestination(dest)
      if (Array.isArray(dest) && dest[0]) pageNumber = (await pdf.getPageIndex(dest[0])) + 1
    } catch {}
    return { title: item.title, pageNumber, items: await Promise.all((item.items || []).map(walk)) }
  }))
}

export async function extractOutline(file) {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
  try {
    return await readOutline(pdf)
  } finally {
    pdf.destroy() // frees its worker
  }
}
