export type VaultSearchResult = {
  id: string
  path: string
  content: string
  metadata: {
    startLine: number
    endLine: number
  }
  score: number
  matchCount: number
}
