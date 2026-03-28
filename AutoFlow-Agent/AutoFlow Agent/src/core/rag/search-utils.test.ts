import { extractSearchTerms, scoreTextAgainstTerms } from './search-utils'

describe('extractSearchTerms', () => {
  it('should keep whole query and split english keywords', () => {
    expect(extractSearchTerms('summarize attention mechanism notes')).toEqual([
      'summarize attention mechanism notes',
      'summarize',
      'attention',
      'mechanism',
      'notes',
    ])
  })

  it('should derive chinese search chunks for long phrases', () => {
    expect(extractSearchTerms('注意力机制的核心区别')).toEqual([
      '注意力机制的核心区别',
      '注意',
      '意力',
      '力机',
      '机制',
      '制的',
      '的核',
      '核心',
      '心区',
      '区别',
    ])
  })
})

describe('scoreTextAgainstTerms', () => {
  it('should count matched terms and total matches', () => {
    expect(
      scoreTextAgainstTerms('注意力机制帮助模型聚焦关键信息。', [
        '注意力机制',
        '模型',
        '区别',
      ]),
    ).toEqual({
      matchedTerms: 2,
      matchCount: 2,
    })
  })
})
