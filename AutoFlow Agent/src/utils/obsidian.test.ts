import { TFile, TFolder } from 'obsidian'

import { calculateFileDistance, getHeadingBlockRange } from './obsidian'

describe('calculateFileDistance', () => {
  // Mock TFile class
  class MockTFile {
    path: string
    constructor(path: string) {
      this.path = path
    }
  }

  it('should calculate the correct distance between files in the same folder', () => {
    const file1 = new MockTFile('folder/file1.md') as TFile
    const file2 = new MockTFile('folder/file2.md') as TFile

    const result = calculateFileDistance(file1, file2)
    expect(result).toBe(2)
  })

  it('should calculate the correct distance between files in different subfolders', () => {
    const file1 = new MockTFile('folder1/folder2/file1.md') as TFile
    const file2 = new MockTFile('folder1/folder3/file2.md') as TFile

    const result = calculateFileDistance(file1, file2)
    expect(result).toBe(4)
  })

  it('should return null for files in different top-level folders', () => {
    const file1 = new MockTFile('folder1/file1.md') as TFile
    const file2 = new MockTFile('folder2/file2.md') as TFile

    const result = calculateFileDistance(file1, file2)
    expect(result).toBeNull()
  })

  it('should handle files at different depths', () => {
    const file1 = new MockTFile('folder1/folder2/subfolder/file1.md') as TFile
    const file2 = new MockTFile('folder1/folder3/file2.md') as TFile

    const result = calculateFileDistance(file1, file2)
    expect(result).toBe(5)
  })

  it('should return 0 for the same file', () => {
    const file = new MockTFile('folder/file.md') as TFile

    const result = calculateFileDistance(file, file)
    expect(result).toBe(0)
  })

  it('should calculate the correct distance between a folder and a file', () => {
    const file = new MockTFile('folder1/folder2/file1.md') as TFile
    const folder = new MockTFile('folder1/folder2') as TFolder

    const result = calculateFileDistance(file, folder)
    expect(result).toBe(1)
  })
})

describe('getHeadingBlockRange', () => {
  it('should return the current heading block when the cursor is inside it', () => {
    const lines = [
      '# Title',
      'intro',
      '## Section A',
      'line 1',
      'line 2',
      '## Section B',
      'line 3',
    ]

    const result = getHeadingBlockRange(lines, 3)

    expect(result).toEqual({
      startLine: 2,
      endLine: 4,
    })
  })

  it('should include nested headings until the next heading of the same or higher level', () => {
    const lines = [
      '# Title',
      'intro',
      '## Section A',
      'line 1',
      '### Detail',
      'detail line',
      '## Section B',
      'line 2',
    ]

    const result = getHeadingBlockRange(lines, 4)

    expect(result).toEqual({
      startLine: 4,
      endLine: 5,
    })
  })

  it('should return null when there is no heading above the cursor', () => {
    const lines = ['plain text', 'more plain text']

    const result = getHeadingBlockRange(lines, 1)

    expect(result).toBeNull()
  })

  it('should trim trailing blank lines from the heading block', () => {
    const lines = ['## Section A', 'content', '', '## Next', 'content']

    const result = getHeadingBlockRange(lines, 1)

    expect(result).toEqual({
      startLine: 0,
      endLine: 1,
    })
  })
})
