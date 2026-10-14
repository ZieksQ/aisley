import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  ButtonWithTooltip,
  CreateLink,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  SingleChoiceToggleGroup,
  UndoRedo,
  iconComponentFor$,
  useCellValue,
  usePublisher,
  viewMode$,
} from '@mdxeditor/editor'
import type { IconKey, ViewMode } from '@mdxeditor/editor'

const modes: Array<{ value: ViewMode; label: string; icon: IconKey }> = [
  { value: 'rich-text', label: 'Rich text', icon: 'rich_text' },
  { value: 'diff', label: 'Diff', icon: 'difference' },
  { value: 'source', label: 'Source', icon: 'markdown' },
]

export function ProductDescriptionToolbar({ readOnly, onInsertSourceTable }: {
  readOnly: boolean
  onInsertSourceTable: () => void
}) {
  const mode = useCellValue(viewMode$)
  const iconComponentFor = useCellValue(iconComponentFor$)
  const changeMode = usePublisher(viewMode$)

  return (
    <div className="product-description-tools">
      <div className="product-description-toolbar-row">
        {mode === 'rich-text' ? (
          <>
            <div className="product-description-tool-group" aria-label="History"><UndoRedo /></div>
            <div className="product-description-tool-group" aria-label="Text style"><BlockTypeSelect /><BoldItalicUnderlineToggles /></div>
            <div className="product-description-tool-group" aria-label="Lists"><ListsToggle /></div>
            <div className="product-description-tool-group" aria-label="Insert content"><CreateLink /><InsertImage /><InsertTable /><InsertThematicBreak /></div>
          </>
        ) : (
          <>
            <span className="product-description-current-mode">{mode === 'source' ? 'Markdown' : 'Compare changes'}</span>
            {mode === 'source' && (
              <ButtonWithTooltip title="Insert table" disabled={readOnly} onClick={onInsertSourceTable}>
                {iconComponentFor('table')}
              </ButtonWithTooltip>
            )}
          </>
        )}
        <div className="product-description-mode-group" role="group" aria-label="Description editor mode">
          <SingleChoiceToggleGroup<ViewMode>
            className="product-description-modes"
            value={mode}
            disabled={readOnly}
            onChange={(value) => { if (value) changeMode(value) }}
            items={modes.map((item) => ({ title: item.label, value: item.value, contents: iconComponentFor(item.icon) }))}
          />
        </div>
      </div>
      {mode === 'diff' && (
        <div className="product-description-diff-labels">
          <span>Loaded description</span>
          <span>Current draft</span>
          <p>Scroll horizontally to compare both versions.</p>
        </div>
      )}
    </div>
  )
}
