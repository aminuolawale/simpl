// App-wide "data changed" signal, so views that summarise data elsewhere on the
// screen (e.g. the side nav) can refresh after a create, rename, link or delete.
const bus = new EventTarget()
const EVENT = 'data-changed'

export function notifyDataChanged() {
  bus.dispatchEvent(new Event(EVENT))
}

export function onDataChanged(callback) {
  bus.addEventListener(EVENT, callback)
  return () => bus.removeEventListener(EVENT, callback)
}
