/**
 * kobo-export — export Kobo highlights, notes and handwriting to markdown,
 * straight from a connected device or any folder that holds its `.kobo/`.
 *
 * Reuses the web app's database queries (`src/models/KoboDB`) and markdown
 * generator, so a book exports identically from the CLI and the browser:
 * `<out>/<book>.md` plus `<out>/assets/<BookmarkID>.png` (page + ink) and
 * `.svg` (ink only). The device is only ever read.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import initSqlJs from 'sql.js'
import sharp from 'sharp'
import { getBook, getBookList, getChaptersWithNotes } from '../src/models/KoboDB'
import type { IBook, IBookChapter } from '../src/types/kobo'
import { generateMarkdownContent, MarkupAsset } from '../src/utils/markdownGenerator'
import { extractPenColors, resolvePenColor } from '../src/utils/penColors'
import { generateSafeFilename } from '../src/utils/safeFilename'

const ASSETS_DIR = 'assets'

const USAGE = `Usage: kobo-export [options]

Export Kobo highlights, notes and handwriting to markdown.

Options:
  -d, --device <path>  Kobo root (the folder holding .kobo/)  [default: /Volumes/KOBOeReader]
  -o, --out <dir>      Output folder                           [default: ./kobo-export]
  -b, --book <text>    Only books whose title contains <text> (case-insensitive)
  -l, --list           List annotated books with their counts; write nothing
  -p, --per-book       One folder per book: <out>/<Book>/<Book>.md, <Book>.markups.json, assets/
  -h, --help           Show this help
`

interface BookExport {
  book: IBook
  chapters: IBookChapter[]
  highlights: number
  markups: number
}

/** Pastes the Kobo ink over its page screenshot, as a PNG. */
async function compositeMarkup(jpg: Buffer, svg: Buffer): Promise<Buffer> {
  const page = sharp(jpg)
  const { width, height } = await page.metadata()
  const ink = await sharp(svg).resize(width, height, { fit: 'fill' }).png().toBuffer()
  return page.composite([{ input: ink }]).png().toBuffer()
}

/**
 * Writes one markup's files into `<out>/assets/` and returns how the markdown
 * should reference them, or null when the device has no files for it (the
 * markdown then keeps its text placeholder).
 */
async function exportMarkup(markupsDir: string, outDir: string, bookmarkId: string): Promise<MarkupAsset | null> {
  const svgFile = join(markupsDir, `${bookmarkId}.svg`)
  const jpgFile = join(markupsDir, `${bookmarkId}.jpg`)
  if (!existsSync(svgFile)) {
    console.warn(`  ! no ink file for markup ${bookmarkId}; kept the placeholder`)
    return null
  }

  const svg = readFileSync(svgFile)
  const svgPath = `${ASSETS_DIR}/${bookmarkId}.svg`
  writeFileSync(join(outDir, svgPath), svg)

  let imagePath = svgPath
  if (existsSync(jpgFile)) {
    try {
      const png = await compositeMarkup(readFileSync(jpgFile), svg)
      imagePath = `${ASSETS_DIR}/${bookmarkId}.png`
      writeFileSync(join(outDir, imagePath), png)
    } catch (err) {
      console.warn(`  ! could not composite markup ${bookmarkId}; embedding the SVG instead (${(err as Error).message})`)
    }
  }

  return { imagePath, svgPath, penColors: extractPenColors(svg.toString('utf8')) }
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      device: { type: 'string', short: 'd', default: '/Volumes/KOBOeReader' },
      out: { type: 'string', short: 'o', default: './kobo-export' },
      book: { type: 'string', short: 'b' },
      list: { type: 'boolean', short: 'l', default: false },
      'per-book': { type: 'boolean', short: 'p', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })

  if (values.help) {
    process.stdout.write(USAGE)
    return 0
  }

  const device = resolve(values.device!)
  const dbFile = join(device, '.kobo', 'KoboReader.sqlite')
  if (!existsSync(dbFile)) {
    console.error(`No Kobo database at ${dbFile}. Is the Kobo connected? (use --device for another folder)`)
    return 1
  }
  if (existsSync(`${dbFile}-wal`)) {
    console.warn('! KoboReader.sqlite-wal exists; changes not yet checkpointed into the database will be missing')
  }

  const require = createRequire(import.meta.url)
  const SQL = await initSqlJs({ locateFile: (file) => join(dirname(require.resolve('sql.js')), file) })
  const db = new SQL.Database(new Uint8Array(readFileSync(dbFile)))

  const filter = values.book?.toLowerCase()
  const exports: BookExport[] = []
  for (const listed of await getBookList(db)) {
    if (filter && !listed.bookTitle?.toLowerCase().includes(filter)) continue
    const chapters = await getChaptersWithNotes(db, listed.contentId)
    const notes = chapters.flatMap((chapter) => chapter.notes ?? [])
    if (notes.length === 0) continue
    const markups = notes.filter((note) => note.type === 'markup').length
    exports.push({
      book: await getBook(db, listed.contentId),
      chapters,
      highlights: notes.length - markups,
      markups,
    })
  }

  if (exports.length === 0) {
    console.log(filter ? `No annotated book matches "${values.book}".` : 'No annotated books found.')
    return 0
  }

  if (values.list) {
    for (const { book, highlights, markups } of exports) {
      console.log(`${String(highlights).padStart(4)} highlights/notes  ${String(markups).padStart(3)} handwriting  ${book.bookTitle}`)
    }
    return 0
  }

  const outDir = resolve(values.out!)
  const markupsDir = join(device, '.kobo', 'markups')

  for (const { book, chapters, highlights, markups } of exports) {
    const filename = generateSafeFilename(book.bookTitle || 'Untitled', 'md')
    // --per-book keeps everything for one book together; image links stay relative (assets/…)
    const bookDir = values['per-book'] ? join(outDir, filename.replace(/\.md$/, '')) : outDir
    mkdirSync(join(bookDir, ASSETS_DIR), { recursive: true })

    const markupAssets = new Map<string, MarkupAsset>()
    for (const note of chapters.flatMap((chapter) => chapter.notes ?? [])) {
      if (note.type !== 'markup') continue
      const asset = await exportMarkup(markupsDir, bookDir, note.bookmarkId)
      if (asset) markupAssets.set(note.bookmarkId, asset)
    }

    writeFileSync(join(bookDir, filename), generateMarkdownContent(book, chapters, { markupAssets }))

    // A machine-readable list of the handwriting, for tools that link to it (e.g. a Zotero note).
    // Holds identifiers, chapters, pens and paths — no book text.
    const manifest = {
      title: book.bookTitle,
      author: book.author,
      markdown: filename,
      markups: chapters.flatMap((chapter) =>
        (chapter.notes ?? [])
          .filter((note) => note.type === 'markup' && markupAssets.has(note.bookmarkId))
          .map((note) => {
            const asset = markupAssets.get(note.bookmarkId)!
            return {
              bookmarkId: note.bookmarkId,
              chapter: chapter.title,
              chapterProgress: note.chapterProgress,
              created: note.dateCreated,
              image: asset.imagePath,
              svg: asset.svgPath,
              pens: (asset.penColors ?? []).map((hex) => ({ hex, ...resolvePenColor(hex) })),
            }
          })
      ),
    }
    writeFileSync(join(bookDir, generateSafeFilename(book.bookTitle || 'Untitled', 'markups.json')), JSON.stringify(manifest, null, 1))
    console.log(`✓ ${filename}  (${highlights} highlights/notes, ${markupAssets.size}/${markups} handwriting)`)
  }

  console.log(`\n${exports.length} book(s) exported to ${outDir}`)
  return 0
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err)
    process.exit(1)
  }
)
