import JSZip from 'jszip'
import type { IBook, IBookChapter } from '@/types/kobo'
import { getMarkupFilesByIds } from '@/services/markupService'
import { compositeMarkupImage } from '@/utils/imageCompositor'
import { downloadFile, generateMarkdownContent, MarkupAsset } from '@/utils/markdownGenerator'
import { extractPenColors } from '@/utils/penColors'

/** Folder, relative to the markdown file, that holds handwriting images. */
export const ASSETS_DIR = 'assets'

export interface MarkdownBundle {
  markdown: string
  /** Files to write next to the markdown, keyed by relative path. Empty when the book has no handwriting. */
  assets: Map<string, Blob | string>
}

const collectMarkupIds = (chapters: IBookChapter[]): string[] =>
  chapters.flatMap((chapter) =>
    (chapter.notes ?? []).filter((note) => note.type === 'markup').map((note) => note.bookmarkId)
  )

/**
 * Builds a book's markdown with its handwriting embedded as images.
 *
 * Each markup yields two files: `assets/<id>.png` (the page with the ink
 * composited on top, which the markdown embeds) and `assets/<id>.svg` (the ink
 * alone, vector, colours intact). If compositing fails the markdown embeds the
 * SVG instead, so the ink is never lost. Markups whose files were not loaded
 * from the device keep the text placeholder.
 */
export async function buildMarkdownBundle(book: IBook, chapters: IBookChapter[]): Promise<MarkdownBundle> {
  const assets = new Map<string, Blob | string>()
  const markupIds = collectMarkupIds(chapters)
  if (markupIds.length === 0) {
    return { markdown: generateMarkdownContent(book, chapters), assets }
  }

  const files = await getMarkupFilesByIds(markupIds)
  const markupAssets = new Map<string, MarkupAsset>()

  for (const [bookmarkId, file] of Array.from(files.entries())) {
    const svgText = new TextDecoder().decode(file.svg)
    const svgPath = `${ASSETS_DIR}/${bookmarkId}.svg`
    assets.set(svgPath, svgText)

    let imagePath = svgPath
    try {
      const png = await compositeMarkupImage(file.jpg, file.svg, 1, 'image/png')
      imagePath = `${ASSETS_DIR}/${bookmarkId}.png`
      assets.set(imagePath, png)
    } catch (err) {
      console.warn(`Failed to composite markup ${bookmarkId}; embedding the SVG instead:`, err)
    }

    markupAssets.set(bookmarkId, { imagePath, svgPath, penColors: extractPenColors(svgText) })
  }

  return { markdown: generateMarkdownContent(book, chapters, { markupAssets }), assets }
}

/** Adds a bundle to a ZIP: the markdown under `markdownPath`, the assets at their relative paths. */
export function addBundleToZip(zip: JSZip, markdownPath: string, bundle: MarkdownBundle): void {
  zip.file(markdownPath, bundle.markdown)
  for (const [path, data] of Array.from(bundle.assets.entries())) {
    zip.file(path, data)
  }
}

/**
 * Downloads one book's notes. A book without handwriting downloads as a plain
 * `.md`, as before; a book with handwriting downloads as a `.zip` holding the
 * `.md` and its `assets/` folder, so the image links resolve once unzipped.
 */
export async function downloadBookMarkdown(book: IBook, chapters: IBookChapter[]): Promise<void> {
  const title = book.bookTitle || book.title || 'Untitled'
  const bundle = await buildMarkdownBundle(book, chapters)

  if (bundle.assets.size === 0) {
    downloadFile(`${title}.md`, bundle.markdown, 'text/markdown')
    return
  }

  const zip = new JSZip()
  addBundleToZip(zip, `${title}.md`, bundle)
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${title}.zip`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
