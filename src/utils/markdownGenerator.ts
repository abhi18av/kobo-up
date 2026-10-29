import { IBook, IBookChapter } from '@/types/kobo'
import { getColorEmoji } from './koboColors'
import { describePenColor } from './penColors'

/** A handwriting annotation's exported files, relative to the markdown file. */
export interface MarkupAsset {
  /** Page screenshot with the ink composited on top. */
  imagePath: string
  /** The ink alone, as the device's vector SVG. */
  svgPath?: string
  /** Pen fills found in the SVG, in first-seen order. */
  penColors?: string[]
}

export interface MarkdownOptions {
  /** Exported files per markup, keyed by bookmarkId. Markups without an entry keep the placeholder. */
  markupAssets?: Map<string, MarkupAsset>
}

const hasNotes = (chapter: IBookChapter): boolean =>
  Boolean(chapter.notes && chapter.notes.length > 0)

/**
 * Returns only the chapters worth a heading in an export.
 *
 * A chapter is kept when it has notes. A parent chapter is also kept when any
 * of its subchapters has notes, so the outline above a note stays intact.
 * Chapters arrive as a flat list in reading order. A chapter's subchapters are
 * the entries right after it that sit deeper than it.
 */
export const filterChaptersWithNotes = (chapters: IBookChapter[]): IBookChapter[] =>
  chapters.filter((chapter, index) => {
    if (hasNotes(chapter)) return true
    for (let next = index + 1; next < chapters.length; next++) {
      if (chapters[next].depth <= chapter.depth) return false
      if (hasNotes(chapters[next])) return true
    }
    return false
  })

export const generateMarkdownContent = (
  book: IBook,
  bookChapterAndNotes: IBookChapter[],
  options: MarkdownOptions = {}
): string => {
  let content = ``

  content += `# ${book.bookTitle}\n`;
  content += `## ${book.author}\n\n`;

  filterChaptersWithNotes(bookChapterAndNotes).forEach((chapter) => {
    const headingPrefix = '#'.repeat(chapter.depth);
    content += `${headingPrefix} ${chapter.title}\n`;

    if (chapter.notes && chapter.notes.length > 0) {
      content += '\n';
      chapter.notes.forEach((chapterNote) => {
        if (chapterNote.type === 'markup') {
          const asset = options.markupAssets?.get(chapterNote.bookmarkId);
          if (asset) {
            content += `* ![Handwriting annotation](${asset.imagePath})\n`;
            const pens = (asset.penColors ?? []).map(describePenColor);
            if (pens.length > 0) content += `  Pens: ${pens.join(' · ')}\n`;
          } else {
            content += `* [Handwriting annotation]\n`;
          }
        } else if (chapterNote.text) {
          const emoji = getColorEmoji(chapterNote.color);
          const prefix = emoji ? `${emoji} ` : '';
          content += `* ${prefix}${chapterNote.text.replace(/\r?\n|\r/g, '').trim()}\n`;
        }
        if (chapterNote.annotation) {
          content += `> ${chapterNote.annotation.replace(/\r?\n|\r/g, '\n> ').trim()}\n`;
        }
      });
      content += '\n';
    }
  })
  return content
}

export const downloadFile = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const downloadMarkdownFile = (filename: string, content: string) => {
  downloadFile(filename, content, 'text/markdown');
}

