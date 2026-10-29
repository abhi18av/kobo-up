import { generateMarkdownContent } from '../markdownGenerator';
import { IBook, IBookChapter } from '@/types/kobo';

describe('generateMarkdownContent', () => {
  const mockBook: IBook = {
    contentId: 'test-book-id',
    bookTitle: 'Test Book',
    author: 'Test Author',
  };

  it('should prepend color emoji to highlights when color is present', () => {
    const chapters: IBookChapter[] = [{
      contentId: 'chapter-1',
      title: 'Chapter 1',
      depth: 2,
      notes: [
        { bookmarkId: '1', text: 'Yellow highlight', color: 0 },
        { bookmarkId: '2', text: 'Pink highlight', color: 1 },
        { bookmarkId: '3', text: 'Blue highlight', color: 2 },
        { bookmarkId: '4', text: 'Green highlight', color: 3 },
      ]
    }];

    const result = generateMarkdownContent(mockBook, chapters);

    expect(result).toContain('* 🟡 Yellow highlight');
    expect(result).toContain('* 🔴 Pink highlight');
    expect(result).toContain('* 🔵 Blue highlight');
    expect(result).toContain('* 🟢 Green highlight');
  });

  it('should not prepend emoji when color is undefined or null', () => {
    const chapters: IBookChapter[] = [{
      contentId: 'chapter-1',
      title: 'Chapter 1',
      depth: 2,
      notes: [
        { bookmarkId: '1', text: 'No color highlight' },
        { bookmarkId: '2', text: 'Null color highlight', color: null },
      ]
    }];

    const result = generateMarkdownContent(mockBook, chapters);

    expect(result).toContain('* No color highlight');
    expect(result).toContain('* Null color highlight');
    expect(result).not.toMatch(/\* 🟡 No color/);
    expect(result).not.toMatch(/\* 🟡 Null color/);
  });

  it('leaves out chapters that have no notes', () => {
    const chapters = [
      { contentId: 'c1', title: 'Empty Chapter', depth: 2, notes: [] },
      { contentId: 'c2', title: 'Noted Chapter', depth: 2, notes: [{ bookmarkId: '1', text: 'A highlight' }] },
      { contentId: 'c3', title: 'Another Empty Chapter', depth: 2, notes: [] },
    ] as unknown as IBookChapter[];

    const result = generateMarkdownContent(mockBook, chapters);

    expect(result).toBe(
      '# Test Book\n' +
      '## Test Author\n\n' +
      '## Noted Chapter\n\n' +
      '* A highlight\n\n'
    );
  });

  it('keeps a parent chapter heading when one of its subchapters has notes', () => {
    const chapters = [
      { contentId: 'p1', title: 'Part One', depth: 2, notes: [] },
      { contentId: 'c1', title: 'Empty Section', depth: 3, notes: [] },
      { contentId: 'c2', title: 'Noted Section', depth: 3, notes: [{ bookmarkId: '1', text: 'A highlight' }] },
      { contentId: 'p2', title: 'Part Two', depth: 2, notes: [] },
      { contentId: 'c3', title: 'Empty Section Two', depth: 3, notes: [] },
    ] as unknown as IBookChapter[];

    const result = generateMarkdownContent(mockBook, chapters);

    expect(result).toBe(
      '# Test Book\n' +
      '## Test Author\n\n' +
      '## Part One\n' +
      '### Noted Section\n\n' +
      '* A highlight\n\n'
    );
  });

  it('gives unchanged output when every chapter has notes', () => {
    const chapters = [
      { contentId: 'c1', title: 'Chapter 1', depth: 2, notes: [{ bookmarkId: '1', text: 'First' }] },
      { contentId: 'c2', title: 'Section 1.1', depth: 3, notes: [{ bookmarkId: '2', text: 'Second', annotation: 'Thought' }] },
    ] as unknown as IBookChapter[];

    const result = generateMarkdownContent(mockBook, chapters);

    expect(result).toBe(
      '# Test Book\n' +
      '## Test Author\n\n' +
      '## Chapter 1\n\n' +
      '* First\n\n' +
      '### Section 1.1\n\n' +
      '* Second\n' +
      '> Thought\n\n'
    );
  });

  describe('handwriting annotations', () => {
    const markupChapter = [{
      contentId: 'c1',
      title: 'Chapter 1',
      depth: 2,
      notes: [{ bookmarkId: 'mk-1', type: 'markup', text: '', annotation: null }],
    }] as unknown as IBookChapter[];

    it('keeps the text placeholder when no exported image is available', () => {
      const result = generateMarkdownContent(mockBook, markupChapter);
      expect(result).toContain('* [Handwriting annotation]\n');
    });

    it('embeds the exported image and lists the pens used', () => {
      const markupAssets = new Map([
        ['mk-1', { imagePath: 'assets/mk-1.png', svgPath: 'assets/mk-1.svg', penColors: ['#c60c30', '#000000'] }],
      ]);
      const result = generateMarkdownContent(mockBook, markupChapter, { markupAssets });

      expect(result).toContain('* ![Handwriting annotation](assets/mk-1.png)\n');
      expect(result).toContain('  Pens: red — disagree · black — my own words\n');
      expect(result).not.toContain('[Handwriting annotation]\n');
    });

    it('omits the pen line when the SVG had no pen fills', () => {
      const markupAssets = new Map([['mk-1', { imagePath: 'assets/mk-1.png', penColors: [] }]]);
      const result = generateMarkdownContent(mockBook, markupChapter, { markupAssets });
      expect(result).not.toContain('Pens:');
    });
  });
});
