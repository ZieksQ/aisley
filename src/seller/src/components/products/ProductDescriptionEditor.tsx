import { useCallback, useMemo, useRef, useState } from 'react'
import {
  MDXEditor,
  diffSourcePlugin,
  headingsPlugin,
  imagePlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from '@mdxeditor/editor'
import { ProductDescriptionToolbar } from './ProductDescriptionToolbar'
import { ApiError, apiAssetUrl, uploadForm } from '../../lib/api'
import './product-description-editor.css'

type UploadedAsset = { id: string; url: string; preview_url: string }
const tableMarkdown = '\n\n| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |\n\n'

export function ProductDescriptionEditor({ markdown, onChange, uploadToken, onAsset, onUploadState, readOnly = false }: {
  markdown: string
  onChange: (markdown: string) => void
  uploadToken: string
  onAsset: (id: string) => void
  onUploadState: (uploading: boolean) => void
  readOnly?: boolean
}) {
  const surface = useRef<HTMLDivElement>(null)
  const initialMarkdown = useRef(markdown)
  const [uploadStatus, setUploadStatus] = useState('')
  const [uploadCount, setUploadCount] = useState(0)
  const [previewUrls] = useState(() => new Map<string, string>())

  const insertSourceTable = useCallback(() => {
    const content = surface.current?.querySelector<HTMLElement>('.mdxeditor-source-editor .cm-content')
    if (!content || readOnly) return
    // CodeMirror handles paste as an editor transaction at its retained selection.
    const data = new DataTransfer()
    data.setData('text/plain', tableMarkdown)
    content.focus({ preventScroll: true })
    content.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  }, [readOnly])

  const plugins = useMemo(() => [
    headingsPlugin(),
    listsPlugin(),
    quotePlugin(),
    linkPlugin(),
    linkDialogPlugin(),
    thematicBreakPlugin(),
    tablePlugin(),
    markdownShortcutPlugin(),
    imagePlugin({
      disableImageResize: true,
      disableImageSettingsButton: true,
      imageUploadHandler: async (file: File) => {
        const form = new FormData()
        form.append('image', file)
        form.append('purpose', 'description')
        form.append('upload_token', uploadToken)
        setUploadCount((count) => count + 1)
        onUploadState(true)
        try {
          const response = await uploadForm<{ data: UploadedAsset }>('/api/v1/seller/product-uploads', form, (progress) => setUploadStatus(`Uploading description image… ${progress}%`))
          previewUrls.set(response.data.url, apiAssetUrl(response.data.preview_url))
          onAsset(response.data.id)
          setUploadStatus('Description image uploaded. It will be finalized when you save the Product.')
          return response.data.url
        } catch (error) {
          setUploadStatus(error instanceof ApiError ? Object.values(error.errors)[0]?.[0] ?? error.message : 'Image upload failed. Try again.')
          throw error
        } finally {
          setUploadCount((count) => count - 1)
          onUploadState(false)
        }
      },
      imagePreviewHandler: async (source) => {
        const temporaryPreview = previewUrls.get(source)
        if (temporaryPreview) return temporaryPreview
        const match = source.match(/^\/api\/v1\/product-description-assets\/([0-9a-f-]{36})$/i)
        return match ? apiAssetUrl(`/api/v1/seller/product-description-assets/${match[1]}`) : source
      },
    }),
    diffSourcePlugin({ viewMode: 'source', diffMarkdown: initialMarkdown.current, readOnlyDiff: true }),
    toolbarPlugin({ toolbarClassName: 'seller-product-toolbar', toolbarContents: () => <ProductDescriptionToolbar readOnly={readOnly || uploadCount > 0} onInsertSourceTable={insertSourceTable} /> }),
  ], [insertSourceTable, onAsset, onUploadState, previewUrls, readOnly, uploadCount, uploadToken])

  return (
    <div className="product-description-editor">
      <div ref={surface} className="product-description-surface" inert={readOnly} aria-disabled={readOnly} aria-busy={readOnly}>
        <MDXEditor
          className="seller-product-editor"
          contentEditableClassName="product-description-content"
          markdown={markdown}
          onChange={(value, normalized) => { if (!normalized && value !== markdown) onChange(value) }}
          placeholder="Describe materials, fit, care instructions, and other useful details."
          plugins={plugins}
          trim={false}
          suppressHtmlProcessing
        />
      </div>
      <div className="product-description-footer">
        <p aria-live="polite">{uploadStatus || 'Images: JPEG, PNG, or WebP · under 10 MiB · 8,000 px per edge · 40 MP'}</p>
        <span aria-label={`${markdown.length.toLocaleString()} of 50,000 characters`}>{markdown.length.toLocaleString()} / 50,000</span>
      </div>
    </div>
  )
}
