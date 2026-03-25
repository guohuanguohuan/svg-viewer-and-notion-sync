import { prepareSimpleSearch } from 'obsidian'

const CJK_PATTERN = /[\u3400-\u9fff]/

export function extractSearchTerms(query: string): string[] {
  const normalizedQuery = query.replace(/\s+/g, ' ').trim()
  if (!normalizedQuery) {
    return []
  }

  const terms: string[] = []
  const seenTerms = new Set<string>()

  const addTerm = (term: string) => {
    const normalizedTerm = term.trim()
    if (!normalizedTerm || seenTerms.has(normalizedTerm)) {
      return
    }

    if (normalizedTerm.length < 2 && !CJK_PATTERN.test(normalizedTerm)) {
      return
    }

    seenTerms.add(normalizedTerm)
    terms.push(normalizedTerm)
  }

  addTerm(normalizedQuery)

  const segments = normalizedQuery
    .split(/[\s,.;:!?，。；：！？、()（）【】[\]{}<>《》"'“”‘’`]+/)
    .filter(Boolean)

  for (const segment of segments) {
    addTerm(segment)

    if (CJK_PATTERN.test(segment) && segment.length > 4) {
      for (let index = 0; index < segment.length - 1; index += 1) {
        addTerm(segment.slice(index, index + 2))
        if (terms.length >= 10) {
          break
        }
      }
    }

    if (terms.length >= 10) {
      break
    }
  }

  return terms.slice(0, 10)
}

export function scoreTextAgainstTerms(text: string, terms: string[]): {
  matchedTerms: number
  matchCount: number
} {
  if (!text || terms.length === 0) {
    return {
      matchedTerms: 0,
      matchCount: 0,
    }
  }

  let matchedTerms = 0
  let matchCount = 0

  for (const term of terms) {
    const search = prepareSimpleSearch(term)
    const result = search(text)
    if (result) {
      matchedTerms += 1
      matchCount += result.matches.length
    }
  }

  return {
    matchedTerms,
    matchCount,
  }
}
