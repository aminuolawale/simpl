import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'

// Entries of the @ menu. `run` is called after the typed "@query" is removed.
export const AT_ITEMS = [
  { id: 'equation', label: 'Equation', hint: 'Inline LaTeX' },
]

export function filterAtItems(query) {
  const q = query.trim().toLowerCase()
  return AT_ITEMS.filter(item => item.label.toLowerCase().startsWith(q))
}

// Typing "@" opens a menu of insertable things. The menu itself is drawn by
// React: this extension reports its state through `onChange` and forwards
// keys to `onKeyDown`, and calls `onSelect(item, pos)` once an item is chosen.
export const AtMenu = Extension.create({
  name: 'atMenu',

  addOptions() {
    return {
      onChange: () => {},
      onKeyDown: () => false,
      onSelect: () => {},
    }
  },

  addProseMirrorPlugins() {
    const { onChange, onKeyDown, onSelect } = this.options
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: new PluginKey('atMenu'),
        char: '@',
        items: ({ query }) => filterAtItems(query),
        command: ({ editor, range, props: item }) => {
          editor.chain().focus().deleteRange(range).run()
          onSelect(item, range.from)
        },
        render: () => ({
          onStart: props => onChange(props),
          onUpdate: props => onChange(props),
          onKeyDown: ({ event }) => onKeyDown(event),
          onExit: () => onChange(null),
        }),
      }),
    ]
  },
})
