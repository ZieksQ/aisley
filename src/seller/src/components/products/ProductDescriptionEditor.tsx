import { useMemo, useState } from 'react'
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  InsertImage,
  InsertThematicBreak,
  ListsToggle,
  MDXEditor,
  UndoRedo,
  headingsPlugin,
  imagePlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from '@mdxeditor/editor'
import { ApiError, apiAssetUrl, uploadForm } from '../../lib/api'

type UploadedAsset = { id: string; url: string; preview_url: string }

export function ProductDescriptionEditor({
  markdown,
  onChange,
  uploadToken,
  onAsset,
}: {
  markdown: string
  onChange: (markdown: string) => void
  uploadToken: string
  onAsset: (id: string) => void
}) {
  const [uploadStatus, setUploadStatus] = useState('')
  const [previewUrls] = useState(() => new Map<string, string>())

  const plugins = useMemo(() => [
    headingsPlugin(),
    listsPlugin(),
    quotePlugin(),
    linkPlugin(),
    linkDialogPlugin(),
    thematicBreakPlugin(),
    markdownShortcutPlugin(),
    imagePlugin({
      disableImageResize: true,
      disableImageSettingsButton: true,
      imageUploadHandler: async (file: File) => {
        const form = new FormData()
        form.append('image', file)
        form.append('purpose', 'description')
        form.append('upload_token', uploadToken)
        try {
          const response = await uploadForm<{ data: UploadedAsset }>('/api/v1/seller/product-uploads', form, (progress) => setUploadStatus(`Uploading description image… ${progress}%`))
          previewUrls.set(response.data.url, apiAssetUrl(response.data.preview_url))
          onAsset(response.data.id)
          setUploadStatus('Description image uploaded. It will be finalized when you save the Product.')
          return response.data.url
        } catch (error) {
          setUploadStatus(error instanceof ApiError ? Object.values(error.errors)[0]?.[0] ?? error.message : 'Image upload failed. Try again.')
          throw error
        }
      },
      imagePreviewHandler: async (source) => {
        const temporaryPreview = previewUrls.get(source)
        if (temporaryPreview) return temporaryPreview
        const match = source.match(/^\/api\/v1\/product-description-assets\/([0-9a-f-]{36})$/i)
        return match ? apiAssetUrl(`/api/v1/seller/product-description-assets/${match[1]}`) : source
      },
    }),
    toolbarPlugin({ toolbarClassName: 'seller-product-toolbar', toolbarContents: () => <><UndoRedo /><BlockTypeSelect /><BoldItalicUnderlineToggles /><ListsToggle /><CreateLink /><InsertThematicBreak /><InsertImage /></> }),
  ], [onAsset, previewUrls, uploadToken])

  return <div>
    <div className="overflow-hidden rounded-lg border border-zinc-300 bg-white focus-within:ring-2 focus-within:ring-[#4C1268]/30 dark:border-white/15 dark:bg-[#18181b]">
      <MDXEditor
        className="seller-product-editor"
        contentEditableClassName="min-h-56 px-4 py-3 text-sm leading-6"
        markdown={markdown}
        onChange={(value, normalized) => { if (!normalized) onChange(value) }}
        placeholder="Describe materials, fit, care instructions, and other useful details."
        plugins={plugins}
        suppressHtmlProcessing
      />
    </div>
    <p aria-live="polite" className="mt-2 text-xs text-zinc-500">{uploadStatus || 'Paste, drop, or use the image toolbar. JPEG, PNG, or WebP; under 10 MiB; up to 8,000 px per edge and 40 MP.'}</p>
  </div>
}
