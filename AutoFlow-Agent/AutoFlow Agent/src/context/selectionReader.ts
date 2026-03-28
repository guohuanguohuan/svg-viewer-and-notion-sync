import { Editor, TFile } from 'obsidian'

import { MentionableBlockData } from '../types/mentionable'

export function readSelectedBlock(
  editor: Editor,
  file: TFile,
): MentionableBlockData | null {
  const selection = editor.getSelection()
  if (!selection) {
    return null
  }

  const startLine = editor.getCursor('from').line
  const endLine = editor.getCursor('to').line
  const selectionContent = editor
    .getValue()
    .split('\n')
    .slice(startLine, endLine + 1)
    .join('\n')

  return {
    content: selectionContent,
    file,
    startLine: startLine + 1,
    endLine: endLine + 1,
  }
}
