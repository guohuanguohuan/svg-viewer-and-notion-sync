import { Editor, TFile } from 'obsidian'

import { MentionableBlockData } from '../types/mentionable'

const MARKDOWN_HEADING_PATTERN = /^(#{1,6})\s+\S/

export function readHeadingBlockAtCursor(
  editor: Editor,
  file: TFile,
): MentionableBlockData | null {
  const lines = editor.getValue().split('\n')
  const headingRange = getHeadingBlockRange(lines, editor.getCursor('from').line)

  if (!headingRange) {
    return null
  }

  return {
    content: lines.slice(headingRange.startLine, headingRange.endLine + 1).join('\n'),
    file,
    startLine: headingRange.startLine + 1,
    endLine: headingRange.endLine + 1,
  }
}

export function getHeadingBlockRange(
  lines: string[],
  cursorLine: number,
): { startLine: number; endLine: number } | null {
  if (lines.length === 0) {
    return null
  }

  const safeCursorLine = Math.max(0, Math.min(cursorLine, lines.length - 1))
  let headingStartLine = -1
  let headingLevel = 0

  for (let lineIndex = safeCursorLine; lineIndex >= 0; lineIndex--) {
    const match = lines[lineIndex].match(MARKDOWN_HEADING_PATTERN)
    if (match) {
      headingStartLine = lineIndex
      headingLevel = match[1].length
      break
    }
  }

  if (headingStartLine === -1) {
    return null
  }

  let headingEndLine = lines.length - 1
  for (let lineIndex = headingStartLine + 1; lineIndex < lines.length; lineIndex++) {
    const match = lines[lineIndex].match(MARKDOWN_HEADING_PATTERN)
    if (match && match[1].length <= headingLevel) {
      headingEndLine = lineIndex - 1
      break
    }
  }

  while (headingEndLine > headingStartLine && lines[headingEndLine].trim() === '') {
    headingEndLine -= 1
  }

  return {
    startLine: headingStartLine,
    endLine: headingEndLine,
  }
}
