import { Editor, MarkdownView } from 'obsidian'

import { MentionableBlockData } from '../types/mentionable'
import { readHeadingBlockAtCursor } from './headingReader'
import { readSelectedBlock } from './selectionReader'

export async function getActiveContextBlockData(
  editor: Editor,
  view: MarkdownView,
): Promise<MentionableBlockData | null> {
  const file = view.file
  if (!file) {
    return null
  }

  return readSelectedBlock(editor, file) ?? readHeadingBlockAtCursor(editor, file)
}
