import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  UndoRedo,
  useCellValue,
  usePublisher,
  viewMode$,
} from '@mdxeditor/editor'
import type { ViewMode } from '@mdxeditor/editor'

const modes: Array<{ value: ViewMode; label: string }> = [
  { value: 'source', label: 'Source' },
  { value: 'rich-text', label: 'Rich text' },
  { value: 'diff', label: 'Diff' },
]

export function ProductDescriptionToolbar({ readOnly, onInsertSourceTable }: {
  readOnly: boolean
  onInsertSourceTable: () => void
}) {
  const mode = useCellValue(viewMode$)
  const changeMode = usePublisher(viewMode$)

  return (
    <div className="product-description-tools">
      <div className="product-description-mode-bar">
        <div className="product-description-modes" role="group" aria-label="Description editor mode">
          {modes.map((item) => (
            <button
              type="button"
              key={item.value}
              data-editor-mode={item.value}
              aria-pressed={mode === item.value}
              disabled={readOnly}
              onClick={() => changeMode(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="product-description-mode-hint">
          {mode === 'source' ? 'Markdown' : mode === 'rich-text' ? 'Visual editing' : 'Compare your changes'}
        </span>
      </div>
      {mode === 'rich-text' ? (
        <div className="product-description-rich-tools">
          <div className="product-description-tool-group" aria-label="History"><UndoRedo /></div>
          <div className="product-description-tool-group" aria-label="Text style"><BlockTypeSelect /><BoldItalicUnderlineToggles /></div>
          <div className="product-description-tool-group" aria-label="Lists"><ListsToggle /></div>
          <div className="product-description-tool-group" aria-label="Insert content"><CreateLink /><InsertImage /><InsertTable /><InsertThematicBreak /></div>
        </div>
      ) : mode === 'source' ? (
        <div className="product-description-source-tools">
          <p>Write Markdown directly, or switch to Rich text for formatting and images.</p>
          <button type="button" className="portal-button product-description-source-table" disabled={readOnly} onClick={onInsertSourceTable}>Insert table</button>
        </div>
      ) : (
        <div className="product-description-diff-labels">
          <span>Loaded description</span>
          <span>Current draft</span>
          <p>Scroll horizontally to compare both versions.</p>
        </div>
      )}
    </div>
  )
}
