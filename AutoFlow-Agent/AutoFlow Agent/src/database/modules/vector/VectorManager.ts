import { PgliteDatabase } from 'drizzle-orm/pglite'
import { backOff } from 'exponential-backoff'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { minimatch } from 'minimatch'
import { App, TFile } from 'obsidian'

import { IndexProgress } from '../../../components/chat-view/QueryProgress'
import { ErrorModal } from '../../../components/modals/ErrorModal'
import {
  LLMAPIKeyInvalidException,
  LLMAPIKeyNotSetException,
  LLMBaseUrlNotSetException,
  LLMRateLimitExceededException,
} from '../../../core/llm/exception'
import {
  InsertEmbedding,
  InsertIndexState,
  SelectEmbedding,
  SelectIndexState,
  VectorMetaData,
} from '../../../database/schema'
import {
  EmbeddingDbStats,
  EmbeddingModelClient,
} from '../../../types/embedding'
import { chunkArray } from '../../../utils/common/chunk-array'

import { VectorRepository } from './VectorRepository'

const INDEX_SPLITTER_VERSION = 'markdown-recursive-v1'

type FileIndexCandidate = {
  file: TFile
  sanitizedContent: string
  contentHash: string
}

type IndexUpdatePlan = {
  pathsToDelete: string[]
  filesToIndex: FileIndexCandidate[]
  statesToRefresh: InsertIndexState[]
}

export class VectorManager {
  private app: App
  private repository: VectorRepository
  private saveCallback: (() => Promise<void>) | null = null
  private vacuumCallback: (() => Promise<void>) | null = null

  private async requestSave() {
    try {
      if (this.saveCallback) {
        await this.saveCallback()
      } else {
        throw new Error('No save callback set')
      }
    } catch (error) {
      new ErrorModal(
        this.app,
        'Error: save failed',
        'Failed to save the vector database changes. Please report this issue to the developer.',
        error instanceof Error ? error.message : 'Unknown error',
        {
          showReportBugButton: true,
        },
      ).open()
    }
  }

  private async requestVacuum() {
    if (this.vacuumCallback) {
      await this.vacuumCallback()
    }
  }

  constructor(app: App, db: PgliteDatabase) {
    this.app = app
    this.repository = new VectorRepository(app, db)
  }

  setSaveCallback(callback: () => Promise<void>) {
    this.saveCallback = callback
  }

  setVacuumCallback(callback: () => Promise<void>) {
    this.vacuumCallback = callback
  }

  async performSimilaritySearch(
    queryVector: number[],
    embeddingModel: EmbeddingModelClient,
    options: {
      minSimilarity: number
      limit: number
      scope?: {
        files: string[]
        folders: string[]
      }
    },
  ): Promise<
    (Omit<SelectEmbedding, 'embedding'> & {
      similarity: number
    })[]
  > {
    return await this.repository.performSimilaritySearch(
      queryVector,
      embeddingModel,
      options,
    )
  }

  async hasDirtyFiles(
    embeddingModel: EmbeddingModelClient,
    options: {
      chunkSize: number
      excludePatterns: string[]
      includePatterns: string[]
    },
  ): Promise<boolean> {
    const plan = await this.buildIncrementalIndexPlan(embeddingModel, options)
    return (
      plan.pathsToDelete.length > 0 ||
      plan.filesToIndex.length > 0 ||
      plan.statesToRefresh.length > 0
    )
  }

  async updateVaultIndexIfNeeded(
    embeddingModel: EmbeddingModelClient,
    options: {
      chunkSize: number
      excludePatterns: string[]
      includePatterns: string[]
    },
    updateProgress?: (indexProgress: IndexProgress) => void,
  ): Promise<boolean> {
    const plan = await this.buildIncrementalIndexPlan(embeddingModel, options)
    if (
      plan.pathsToDelete.length === 0 &&
      plan.filesToIndex.length === 0 &&
      plan.statesToRefresh.length === 0
    ) {
      return false
    }

    await this.applyIndexUpdatePlan(
      embeddingModel,
      options,
      plan,
      false,
      updateProgress,
    )
    return true
  }

  async updateVaultIndex(
    embeddingModel: EmbeddingModelClient,
    options: {
      chunkSize: number
      excludePatterns: string[]
      includePatterns: string[]
      reindexAll?: boolean
    },
    updateProgress?: (indexProgress: IndexProgress) => void,
  ): Promise<void> {
    const plan = options.reindexAll
      ? await this.buildFullReindexPlan(options)
      : await this.buildIncrementalIndexPlan(embeddingModel, options)

    await this.applyIndexUpdatePlan(
      embeddingModel,
      options,
      plan,
      options.reindexAll ?? false,
      updateProgress,
    )
  }

  async clearAllVectors(embeddingModel: EmbeddingModelClient) {
    await this.repository.clearAllVectors(embeddingModel)
    await this.repository.clearAllIndexStates(embeddingModel)
    await this.requestVacuum()
    await this.requestSave()
  }

  async getEmbeddingStats(): Promise<EmbeddingDbStats[]> {
    return await this.repository.getEmbeddingStats()
  }

  private async applyIndexUpdatePlan(
    embeddingModel: EmbeddingModelClient,
    options: {
      chunkSize: number
      excludePatterns: string[]
      includePatterns: string[]
    },
    plan: IndexUpdatePlan,
    reindexAll: boolean,
    updateProgress?: (indexProgress: IndexProgress) => void,
  ): Promise<void> {
    if (reindexAll) {
      await this.repository.clearAllVectors(embeddingModel)
      await this.repository.clearAllIndexStates(embeddingModel)
    } else if (plan.pathsToDelete.length > 0) {
      await this.repository.deleteVectorsForMultipleFiles(
        plan.pathsToDelete,
        embeddingModel,
      )
      await this.repository.deleteIndexStatesForMultipleFiles(
        plan.pathsToDelete,
        embeddingModel,
      )
    }

    if (plan.statesToRefresh.length > 0) {
      await this.repository.upsertIndexStates(plan.statesToRefresh)
    }

    if (plan.filesToIndex.length === 0) {
      if (reindexAll || plan.pathsToDelete.length > 0 || plan.statesToRefresh.length > 0) {
        await this.requestSave()
      }
      return
    }

    await this.repository.deleteVectorsForMultipleFiles(
      plan.filesToIndex.map((candidate) => candidate.file.path),
      embeddingModel,
    )
    await this.repository.deleteIndexStatesForMultipleFiles(
      plan.filesToIndex.map((candidate) => candidate.file.path),
      embeddingModel,
    )

    const textSplitter = RecursiveCharacterTextSplitter.fromLanguage(
      'markdown',
      {
        chunkSize: options.chunkSize,
      },
    )

    const failedFiles: { path: string; error: string }[] = []
    const expectedChunkCounts = new Map<string, number>()
    const contentChunks = (
      await Promise.all(
        plan.filesToIndex.map(async (candidate) => {
          try {
            const fileDocuments = await textSplitter.createDocuments([
              candidate.sanitizedContent,
            ])
            expectedChunkCounts.set(candidate.file.path, fileDocuments.length)

            return fileDocuments.map(
              (chunk): Omit<InsertEmbedding, 'model' | 'dimension'> => {
                return {
                  path: candidate.file.path,
                  mtime: candidate.file.stat.mtime,
                  content: chunk.pageContent,
                  metadata: {
                    startLine: chunk.metadata.loc.lines.from as number,
                    endLine: chunk.metadata.loc.lines.to as number,
                  },
                }
              },
            )
          } catch (error) {
            failedFiles.push({
              path: candidate.file.path,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
            return []
          }
        }),
      )
    ).flat()

    if (failedFiles.length > 0) {
      const errorDetails =
        `Failed to process ${failedFiles.length} file(s):\n\n` +
        failedFiles
          .map(({ path, error }) => `File: ${path}\nError: ${error}`)
          .join('\n\n')

      new ErrorModal(
        this.app,
        'Error: chunk embedding failed',
        `Some files failed to process. Please report this issue to the developer if it persists.`,
        `[Error Log]\n\n${errorDetails}`,
        {
          showReportBugButton: true,
        },
      ).open()
    }

    if (contentChunks.length === 0) {
      if (plan.pathsToDelete.length > 0 || plan.statesToRefresh.length > 0) {
        await this.requestSave()
      }
      return
    }

    updateProgress?.({
      completedChunks: 0,
      totalChunks: contentChunks.length,
      totalFiles: plan.filesToIndex.length,
    })

    let completedChunks = 0
    const batchChunks = chunkArray(contentChunks, 100)
    const failedChunks: {
      path: string
      metadata: VectorMetaData
      error: string
    }[] = []
    const successfulChunkCounts = new Map<string, number>()

    try {
      for (const batchChunk of batchChunks) {
        const embeddingChunks: (InsertEmbedding | null)[] = await Promise.all(
          batchChunk.map(async (chunk) => {
            try {
              return await backOff(
                async () => {
                  if (chunk.content.length === 0) {
                    throw new Error(
                      `Chunk content is empty in file: ${chunk.path}`,
                    )
                  }
                  if (chunk.content.includes('\x00')) {
                    throw new Error(
                      `Chunk content contains null bytes in file: ${chunk.path}`,
                    )
                  }

                  const embedding = await embeddingModel.getEmbedding(
                    chunk.content,
                  )
                  completedChunks += 1
                  successfulChunkCounts.set(
                    chunk.path,
                    (successfulChunkCounts.get(chunk.path) ?? 0) + 1,
                  )

                  updateProgress?.({
                    completedChunks,
                    totalChunks: contentChunks.length,
                    totalFiles: plan.filesToIndex.length,
                  })

                  return {
                    path: chunk.path,
                    mtime: chunk.mtime,
                    content: chunk.content,
                    model: embeddingModel.id,
                    dimension: embeddingModel.dimension,
                    embedding,
                    metadata: chunk.metadata,
                  }
                },
                {
                  numOfAttempts: 8,
                  startingDelay: 2000,
                  timeMultiple: 2,
                  maxDelay: 60000,
                  retry: (error) => {
                    if (
                      error instanceof LLMRateLimitExceededException ||
                      error.status === 429
                    ) {
                      updateProgress?.({
                        completedChunks,
                        totalChunks: contentChunks.length,
                        totalFiles: plan.filesToIndex.length,
                        waitingForRateLimit: true,
                      })
                      return true
                    }
                    return false
                  },
                },
              )
            } catch (error) {
              failedChunks.push({
                path: chunk.path,
                metadata: chunk.metadata,
                error: error instanceof Error ? error.message : 'Unknown error',
              })

              return null
            }
          }),
        )

        const validEmbeddingChunks = embeddingChunks.filter(
          (chunk) => chunk !== null,
        )
        if (validEmbeddingChunks.length === 0 && batchChunk.length > 0) {
          throw new Error(
            'All chunks in batch failed to embed. Stopping indexing process.',
          )
        }
        await this.repository.insertVectors(validEmbeddingChunks)
      }

      const configHash = await this.getIndexConfigHash(options)
      const successfulStates = plan.filesToIndex
        .filter((candidate) => {
          const expectedCount = expectedChunkCounts.get(candidate.file.path) ?? 0
          const actualCount = successfulChunkCounts.get(candidate.file.path) ?? 0
          return expectedCount > 0 && expectedCount === actualCount
        })
        .map((candidate): InsertIndexState => {
          return this.createIndexStateRecord({
            path: candidate.file.path,
            model: embeddingModel.id,
            dimension: embeddingModel.dimension,
            fileMtime: candidate.file.stat.mtime,
            fileSize: candidate.file.stat.size,
            contentHash: candidate.contentHash,
            configHash,
            chunkCount: expectedChunkCounts.get(candidate.file.path) ?? 0,
          })
        })

      await this.repository.upsertIndexStates(successfulStates)
    } catch (error) {
      if (
        error instanceof LLMAPIKeyNotSetException ||
        error instanceof LLMAPIKeyInvalidException ||
        error instanceof LLMBaseUrlNotSetException
      ) {
        new ErrorModal(this.app, 'Error', (error as Error).message, undefined, {
          showSettingsButton: true,
        }).open()
      } else {
        const errorDetails =
          `Failed to process ${failedChunks.length} file(s):\n\n` +
          failedChunks
            .map((chunk) => `File: ${chunk.path}\nError: ${chunk.error}`)
            .join('\n\n')

        new ErrorModal(
          this.app,
          'Error: embedding failed',
          `The indexing process was interrupted because several files couldn't be processed.
Please report this issue to the developer if it persists.`,
          `[Error Log]\n\n${errorDetails}`,
          {
            showReportBugButton: true,
          },
        ).open()
      }
    } finally {
      await this.requestSave()
    }
  }

  private async buildFullReindexPlan(options: {
    excludePatterns: string[]
    includePatterns: string[]
  }): Promise<IndexUpdatePlan> {
    const filesToIndex = (
      await Promise.all(
        this.getIncludedFiles(
          options.excludePatterns,
          options.includePatterns,
        ).map(async (file) => {
          const sanitizedContent = await this.readSanitizedFile(file)
          if (sanitizedContent.length === 0) {
            return null
          }

          return {
            file,
            sanitizedContent,
            contentHash: await this.sha256Hex(sanitizedContent),
          } satisfies FileIndexCandidate
        }),
      )
    ).filter(Boolean) as FileIndexCandidate[]

    return {
      pathsToDelete: [],
      filesToIndex,
      statesToRefresh: [],
    }
  }

  private async buildIncrementalIndexPlan(
    embeddingModel: EmbeddingModelClient,
    options: {
      chunkSize: number
      excludePatterns: string[]
      includePatterns: string[]
    },
  ): Promise<IndexUpdatePlan> {
    const files = this.getIncludedFiles(
      options.excludePatterns,
      options.includePatterns,
    )
    const includedPaths = new Set(files.map((file) => file.path))
    const [indexedFilePaths, chunkCounts, indexStates, configHash] =
      await Promise.all([
        this.repository.getIndexedFilePaths(embeddingModel),
        this.repository.getIndexedFileChunkCounts(embeddingModel),
        this.repository.getIndexStates(embeddingModel),
        this.getIndexConfigHash(options),
      ])

    const indexStateMap = new Map<string, SelectIndexState>(
      indexStates.map((state) => [state.path, state]),
    )
    const pathsToDelete = new Set<string>()

    for (const path of new Set([
      ...indexedFilePaths,
      ...indexStates.map((state) => state.path),
    ])) {
      if (!includedPaths.has(path)) {
        pathsToDelete.add(path)
      }
    }

    const filesToIndex: FileIndexCandidate[] = []
    const statesToRefresh: InsertIndexState[] = []

    for (const file of files) {
      const currentChunkCount = chunkCounts.get(file.path) ?? 0
      const hasIndexedVectors = chunkCounts.has(file.path)
      const state = indexStateMap.get(file.path)

      if (
        state &&
        state.dimension === embeddingModel.dimension &&
        state.configHash === configHash &&
        state.fileMtime === file.stat.mtime &&
        state.fileSize === file.stat.size &&
        hasIndexedVectors &&
        state.chunkCount === currentChunkCount
      ) {
        continue
      }

      const sanitizedContent = await this.readSanitizedFile(file)
      if (sanitizedContent.length === 0) {
        if (state || hasIndexedVectors) {
          pathsToDelete.add(file.path)
        }
        continue
      }

      const contentHash = await this.sha256Hex(sanitizedContent)

      if (
        state &&
        state.dimension === embeddingModel.dimension &&
        state.configHash === configHash &&
        state.contentHash === contentHash &&
        hasIndexedVectors &&
        state.chunkCount === currentChunkCount
      ) {
        statesToRefresh.push(
          this.createIndexStateRecord({
            path: file.path,
            model: embeddingModel.id,
            dimension: embeddingModel.dimension,
            fileMtime: file.stat.mtime,
            fileSize: file.stat.size,
            contentHash,
            configHash,
            chunkCount: currentChunkCount,
          }),
        )
        continue
      }

      filesToIndex.push({
        file,
        sanitizedContent,
        contentHash,
      })
    }

    return {
      pathsToDelete: [...pathsToDelete],
      filesToIndex,
      statesToRefresh,
    }
  }

  private createIndexStateRecord({
    path,
    model,
    dimension,
    fileMtime,
    fileSize,
    contentHash,
    configHash,
    chunkCount,
  }: {
    path: string
    model: string
    dimension: number
    fileMtime: number
    fileSize: number
    contentHash: string
    configHash: string
    chunkCount: number
  }): InsertIndexState {
    return {
      path,
      model,
      dimension,
      fileMtime,
      fileSize,
      contentHash,
      configHash,
      chunkCount,
      indexedAt: new Date(),
    }
  }

  private getIncludedFiles(
    excludePatterns: string[],
    includePatterns: string[],
  ): TFile[] {
    let files = this.app.vault.getMarkdownFiles()

    files = files.filter((file) => {
      return !excludePatterns.some((pattern) => minimatch(file.path, pattern))
    })

    if (includePatterns.length > 0) {
      files = files.filter((file) => {
        return includePatterns.some((pattern) => minimatch(file.path, pattern))
      })
    }

    return files
  }

  private async readSanitizedFile(file: TFile): Promise<string> {
    const fileContent = await this.app.vault.cachedRead(file)
    return fileContent.replace(/\x00/g, '')
  }

  private async getIndexConfigHash(options: {
    chunkSize: number
    excludePatterns: string[]
    includePatterns: string[]
  }): Promise<string> {
    return await this.sha256Hex(
      JSON.stringify({
        chunkSize: options.chunkSize,
        excludePatterns: [...options.excludePatterns].sort(),
        includePatterns: [...options.includePatterns].sort(),
        splitterVersion: INDEX_SPLITTER_VERSION,
      }),
    )
  }

  private async sha256Hex(text: string): Promise<string> {
    const subtle = globalThis.crypto?.subtle
    if (subtle) {
      const encoded = new TextEncoder().encode(text)
      const digest = await subtle.digest('SHA-256', encoded)
      return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
    }

    try {
      const nodeCrypto = window.require?.('crypto') as
        | typeof import('crypto')
        | undefined
      if (!nodeCrypto) {
        throw new Error('Crypto API unavailable')
      }
      return nodeCrypto.createHash('sha256').update(text).digest('hex')
    } catch (error) {
      throw new Error(
        `Failed to hash file content: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }
}
