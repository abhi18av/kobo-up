import { describePenColor, extractPenColors, resolvePenColor } from '../penColors'

// Mirrors the Qt-generated SVG Kobo writes to .kobo/markups/<BookmarkID>.svg:
// a root group with fill="none", then one filled group per pen run.
const markupSvg = (fills: string[]) => `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="1264" height="1680" viewBox="0 0 1264 1680" xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny">
<title>Qt SVG Document</title>
<g fill="none" stroke="black" stroke-width="1" fill-rule="evenodd" stroke-linecap="square" stroke-linejoin="bevel" >
${fills
  .map(
    (fill) => `<g fill="${fill}" fill-opacity="1" stroke="none" transform="matrix(1,0,0,1,0,0)"
font-family="Rakuten Serif" font-size="12" font-weight="400" font-style="normal"
>
<path vector-effect="none" fill-rule="nonzero" d="M116.5,225 L116.939,223.939 Z"/>
</g>`
  )
  .join('\n')}
</g>
</svg>`

describe('extractPenColors', () => {
  it('returns each pen fill once, in first-seen order', () => {
    const svg = markupSvg(['#c60c30', '#000000', '#c60c30'])
    expect(extractPenColors(svg)).toEqual(['#c60c30', '#000000'])
  })

  it('ignores named fills such as the root group fill="none"', () => {
    expect(extractPenColors(markupSvg([]))).toEqual([])
  })

  it('lowercases hex so the palette lookup is case-insensitive', () => {
    expect(extractPenColors(markupSvg(['#C60C30']))).toEqual(['#c60c30'])
  })
})

describe('resolvePenColor', () => {
  it('names measured pens and attaches their meaning', () => {
    expect(resolvePenColor('#c60c30')).toEqual({ name: 'red', meaning: 'disagree' })
    expect(resolvePenColor('#000000')).toEqual({ name: 'black', meaning: 'my own words' })
  })

  it('reports an uncalibrated fill by its hex instead of dropping it', () => {
    expect(resolvePenColor('#ABCDEF')).toEqual({ name: '#abcdef' })
  })
})

describe('describePenColor', () => {
  it('formats a known pen as "name — meaning"', () => {
    expect(describePenColor('#c60c30')).toBe('red — disagree')
  })

  it('formats an unknown pen as its hex', () => {
    expect(describePenColor('#123456')).toBe('#123456')
  })
})
