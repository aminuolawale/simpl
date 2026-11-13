export function flattenOutline(outline) {
  const result = []
  function walk(items) {
    for (const item of items) {
      result.push({ title: item.title, pageNumber: item.pageNumber })
      if (item.items?.length) walk(item.items)
    }
  }
  walk(outline ?? [])
  return result
}

export function sectionsAfter(outline, startTitle) {
  const flat = flattenOutline(outline)
  const idx = flat.findIndex(s => s.title === startTitle)
  if (idx === -1) return flat
  return flat.slice(idx + 1)
}

export function sectionPage(outline, title) {
  return flattenOutline(outline).find(s => s.title === title)?.pageNumber ?? null
}

export function isValidRange(outline, startTitle, endTitle) {
  const flat = flattenOutline(outline)
  const si = flat.findIndex(s => s.title === startTitle)
  const ei = flat.findIndex(s => s.title === endTitle)
  return si !== -1 && ei !== -1 && ei > si
}
