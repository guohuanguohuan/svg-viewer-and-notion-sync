import { Editor, MarkdownView, TFile } from 'obsidian'

import { getActiveContextBlockData } from './activeContext'

function createEditorMock(params: {
  selection: string
  value: string
  fromLine: number
  toLine: number
}): Editor {
  return {
    getSelection: () => params.selection,
    getValue: () => params.value,
    getCursor: (which?: 'from' | 'to') => ({
      line: which === 'to' ? params.toLine : params.fromLine,
      ch: 0,
    }),
  } as unknown as Editor
}

function createViewMock(file: TFile | null): MarkdownView {
  return {
    file,
  } as MarkdownView
}

describe('getActiveContextBlockData', () => {
  it('should prefer the selected block when selection exists', async () => {
    const file = { path: 'notes/test.md', name: 'test.md' } as TFile
    const editor = createEditorMock({
      selection: 'selected line',
      value: '# Title\nselected line\nnext line',
      fromLine: 1,
      toLine: 1,
    })

    const result = await getActiveContextBlockData(editor, createViewMock(file))

    expect(result).toEqual({
      content: 'selected line',
      file,
      startLine: 2,
      endLine: 2,
    })
  })

  it('should fall back to the current heading block when nothing is selected', async () => {
    const file = { path: 'notes/test.md', name: 'test.md' } as TFile
    const editor = createEditorMock({
      selection: '',
      value: '# Title\nintro\n## Section A\nline 1\nline 2\n## Section B\nline 3',
      fromLine: 3,
      toLine: 3,
    })

    const result = await getActiveContextBlockData(editor, createViewMock(file))

    expect(result).toEqual({
      content: '## Section A\nline 1\nline 2',
      file,
      startLine: 3,
      endLine: 5,
    })
  })

  it('should return null when there is no active file', async () => {
    const editor = createEditorMock({
      selection: '',
      value: '# Title\ncontent',
      fromLine: 1,
      toLine: 1,
    })

    const result = await getActiveContextBlockData(editor, createViewMock(null))

    expect(result).toBeNull()
  })
})
