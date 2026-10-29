/**
 * Turns a book title into a safe filename: drops characters that are invalid
 * in filenames, hyphenates whitespace, and caps the title at 100 characters.
 */
export function generateSafeFilename(title: string, extension: string): string {
  const safeTitle = title
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 100)

  return `${safeTitle}.${extension}`
}
