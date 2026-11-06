import { useState } from 'react'

type Preferences = { understood: string[]; visible?: boolean; finished?: boolean }

function read(key: string): Preferences {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (value && typeof value === 'object' && 'understood' in value && Array.isArray(value.understood)) {
      return {
        understood: value.understood.filter((id): id is string => typeof id === 'string'),
        visible: 'visible' in value && typeof value.visible === 'boolean' ? value.visible : undefined,
        finished: 'finished' in value && value.finished === true,
      }
    }
  } catch { /* Storage may be blocked or contain an obsolete value. */ }
  return { understood: [] }
}

export function useGuidePreferences(key: string, autoShow: boolean) {
  const [initial] = useState(() => read(key))
  const [understood, setUnderstood] = useState(initial.understood)
  const [visible, setVisible] = useState(initial.finished ? false : (initial.visible ?? autoShow))
  const [finished, setFinished] = useState(initial.finished ?? false)
  const [memoryOnly, setMemoryOnly] = useState(false)

  function save(next: Preferences) {
    try { localStorage.setItem(key, JSON.stringify(next)) }
    catch { setMemoryOnly(true) }
  }

  return {
    understood, visible, memoryOnly,
    toggle(id: string) {
      const next = understood.includes(id) ? understood.filter(value => value !== id) : [...understood, id]
      setUnderstood(next)
      setFinished(false)
      save({ understood: next, visible, finished: false })
    },
    show(next: boolean) {
      setVisible(next)
      save({ understood, visible: next, finished })
    },
    finish() {
      setFinished(true)
      save({ understood, visible, finished: true })
    },
  }
}
