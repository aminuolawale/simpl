import { createContext, useContext, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`

async function resolveOutline(pdf, outline) {
  if (!outline || outline.length === 0) return []
  return Promise.all(
    outline.map(async (item) => {
      let pageNumber = null
      try {
        if (item.dest) {
          let dest = item.dest
          if (typeof dest === 'string') dest = await pdf.getDestination(dest)
          if (Array.isArray(dest) && dest[0]) {
            pageNumber = (await pdf.getPageIndex(dest[0])) + 1
          }
        }
      } catch {}
      return {
        title: item.title,
        pageNumber,
        items: await resolveOutline(pdf, item.items || []),
      }
    })
  )
}

const PdfContext = createContext(null)

export function PdfProvider({ children }) {
  const [pdfDoc, setPdfDoc] = useState(null)
  const [outline, setOutline] = useState([])
  const [pageCount, setPageCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.2)
  const [fileName, setFileName] = useState('')

  const loadPdf = useCallback(async (file) => {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const rawOutline = await pdf.getOutline()
    const resolved = await resolveOutline(pdf, rawOutline)
    setPdfDoc(pdf)
    setOutline(resolved)
    setPageCount(pdf.numPages)
    setCurrentPage(1)
    setFileName(file.name)
  }, [])

  const zoomIn  = useCallback(() => setScale(s => Math.min(s + 0.2, 3)), [])
  const zoomOut = useCallback(() => setScale(s => Math.max(s - 0.2, 0.4)), [])

  return (
    <PdfContext.Provider value={{
      pdfDoc, outline, pageCount, currentPage, setCurrentPage,
      scale, zoomIn, zoomOut, loadPdf, fileName,
    }}>
      {children}
    </PdfContext.Provider>
  )
}

export function usePdf() {
  return useContext(PdfContext)
}
