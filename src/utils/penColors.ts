/**
 * Pen colours used in Kobo stylus markups.
 *
 * A markup's SVG stores every stroke as a filled path whose `fill` is the pen
 * colour, so the pens used in a markup can be read back from the SVG. The
 * database `Color` column is 0 for every markup and does not carry this.
 *
 * Hex values are measured from real markups, not guessed. A fill that is not
 * in the table is reported by its hex, so an uncalibrated pen is never
 * silently dropped. To calibrate, write one stroke in each pen colour on a
 * page, sync, and add the fills this module reports.
 */

export interface PenColor {
  name: string
  /** What the pen means in the reading scheme, if it has a meaning. */
  meaning?: string
}

/** Measured fills → pen name. Libra Colour, firmware 4.46. */
export const PEN_PALETTE: Record<string, string> = {
  '#000000': 'black',
  '#c60c30': 'red',
  '#ffd44d': 'yellow', // confirmed by the founder, 2026-10-31
}

/**
 * The thinking-on-the-fly scheme for the ten Libra Colour pens. The four
 * colours shared with highlights (yellow, sky-blue, pink, green) mean the same
 * as their highlight swatch, so a page reads consistently.
 */
export const PEN_MEANINGS: Record<string, string> = {
  black: 'my own words',
  grey: 'structure',
  yellow: 'fact / definition',
  'sky-blue': 'quote / resonates',
  pink: 'question',
  green: 'try this',
  'light-green': 'practised',
  orange: 'connection',
  red: 'disagree',
  purple: 'craft',
}

const FILL_HEX = /fill\s*[=:]\s*"?(#[0-9a-fA-F]{6})\b/g

/**
 * Returns the distinct pen fills in a markup SVG, lowercased, in the order
 * they first appear. Named fills such as the root group's `fill="none"` are
 * not pens and are skipped.
 */
export function extractPenColors(svg: string): string[] {
  const seen: string[] = []
  for (const match of Array.from(svg.matchAll(FILL_HEX))) {
    const hex = match[1].toLowerCase()
    if (!seen.includes(hex)) seen.push(hex)
  }
  return seen
}

/** Resolves a fill hex to its pen name and meaning, or to the bare hex. */
export function resolvePenColor(hex: string): PenColor {
  const name = PEN_PALETTE[hex.toLowerCase()]
  if (!name) return { name: hex.toLowerCase() }
  return { name, meaning: PEN_MEANINGS[name] }
}

/** Formats a pen for a markdown legend: `red — disagree`, or the bare hex. */
export function describePenColor(hex: string): string {
  const { name, meaning } = resolvePenColor(hex)
  return meaning ? `${name} — ${meaning}` : name
}
