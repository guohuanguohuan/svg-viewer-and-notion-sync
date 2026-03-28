import { App, TFile } from 'obsidian'
import { minimatch } from 'minimatch'

import { QueryProgressState } from '../../components/chat-view/QueryProgress'
import { SmartComposerSettings } from '../../settings/schema/setting.types'
import { VaultSearchResult } from '../../types/rag'
import { readTFileContent } from '../../utils/obsidian'

import { extractSearchTerms, scoreTextAgainstTerms } from './search-utils'

type QueryScope = {
  files: string[]
  folders: string[]
}

type FileSnippet = {
  content: string
  startLine: number
  endLine: number
}

export class RAGEngine {
  private app: App
  private settings: SmartComposerSettings

  constructor(app: App, settings: SmartComposerSettings) {
    this.app = app
    this.settings = settings
  }

  cleanup() {
    // Search-based RAG does not keep persistent engine state.
  }

  setSettings(settings: SmartComposerSettings) {
    this.settings = settings
  }

  async updateVaultIndex(
    _options: { reindexAll: boolean } = {
      reindexAll: false,
    },
    onQueryProgressChange?: (queryProgress: QueryProgressState) => void,
  ): Promise<void> {
    const totalFiles = this.getCandidateFiles().length

    onQueryProgressChange?.({
      type: 'indexing',
      indexProgress: {
        completedChunks: totalFiles,
        totalChunks: totalFiles,
        totalFiles,
      },
    })

    onQueryProgressChange?.({
      type: 'idle',
    })
  }

  async processQuery({
    query,
    scope,
    onQueryProgressChange,
  }: {
    query: string
    scope?: QueryScope
    onQueryProgressChange?: (queryProgress: QueryProgressState) => void
  }): Promise<VaultSearchResult[]> {
    const terms = extractSearchTerms(query)

    if (terms.length === 0) {
      onQueryProgressChange?.({
        type: 'querying-done',
        queryResult: [],
      })
      return []
    }

    onQueryProgressChange?.({
      type: 'querying',
    })

    const files = this.getCandidateFiles(scope)
    const results: VaultSearchResult[] = []

    for (const file of files) {
      const content = await readTFileContent(file, this.app.vault)
      const { matchedTerms, matchCount } = scoreTextAgainstTerms(content, terms)

      if (matchedTerms === 0 || matchCount === 0) {
        continue
      }

      const snippet = this.extractBestSnippet(content, terms)

      results.push({
        id: `${file.path}:${snippet.startLine}:${snippet.endLine}`,
        path: file.path,
        content: snippet.content,
        metadata: {
          startLine: snippet.startLine,
          endLine: snippet.endLine,
        },
        score: matchedTerms * 100 + matchCount,
        matchCount,
      })
    }

    const limitedResults = results
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score
        }

        if (b.matchCount !== a.matchCount) {
          return b.matchCount - a.matchCount
        }

        return a.path.localeCompare(b.path)
      })
      .slice(0, this.settings.ragOptions.limit)

    onQueryProgressChange?.({
      type: 'querying-done',
      queryResult: limitedResults,
    })

    return limitedResults
  }

  private getCandidateFiles(scope?: QueryScope): TFile[] {
    const allFiles = this.app.vault.getMarkdownFiles()

    return allFiles.filter((file) => {
      if (!this.matchesScope(file, scope)) {
        return false
      }

      if (
        this.settings.ragOptions.excludePatterns.some((pattern) =>
          minimatch(file.path, pattern),
        )
      ) {
        return false
      }

      if (this.settings.ragOptions.includePatterns.length === 0) {
        return true
      }

      return this.settings.ragOptions.includePatterns.some((pattern) =>
        minimatch(file.path, pattern),
      )
    })
  }

  private matchesScope(file: TFile, scope?: QueryScope): boolean {
    if (!scope) {
      return true
    }

    const matchesFile = scope.files.includes(file.path)
    const matchesFolder = scope.folders.some(
      (folderPath) =>
        file.path === folderPath || file.path.startsWith(`${folderPath}/`),
    )

    if (scope.files.length === 0 && scope.folders.length === 0) {
      return true
    }

    return matchesFile || matchesFolder
  }

  private extractBestSnippet(content: string, terms: string[]): FileSnippet {
    const lines = content.split('\n')

    if (lines.length === 0) {
      return {
        content: '',
        startLine: 1,
        endLine: 1,
      }
    }

    const approxMaxChars = Math.max(400, this.settings.ragOptions.chunkSize)
    let bestStart = 0
    let bestEnd = 0
    let bestScore = -1

    for (let index = 0; index < lines.length; index += 1) {
      const start = Math.max(0, index - 2)
      let end = index
      let collected = ''

      while (end < lines.length) {
        const next = collected
          ? `${collected}\n${lines[end]}`
          : lines[end]

        if (next.length > approxMaxChars && end > index) {
          break
        }

        collected = next
        end += 1
      }

      const { matchedTerms, matchCount } = scoreTextAgainstTerms(
        collected,
        terms,
      )
      const score = matchedTerms * 100 + matchCount

      if (score > bestScore) {
        bestScore = score
        bestStart = start
        bestEnd = Math.max(start + 1, end)
      }
    }

    const snippetContent = lines.slice(bestStart, bestEnd).join('\n').trim()

    return {
      content: snippetContent,
      startLine: bestStart + 1,
      endLine: bestEnd,
    }
  }
}
