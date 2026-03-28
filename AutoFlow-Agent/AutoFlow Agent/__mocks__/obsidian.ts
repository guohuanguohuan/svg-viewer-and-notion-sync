export const App = jest.fn()
export const Editor = jest.fn()
export const MarkdownView = jest.fn()
export const TFile = jest.fn()
export const TFolder = jest.fn()
export const Vault = jest.fn()
export const normalizePath = jest.fn((path: string) => path)

export const prepareSimpleSearch = jest.fn((query: string) => {
  const normalizedQuery = query.toLocaleLowerCase()

  return (text: string) => {
    const normalizedText = text.toLocaleLowerCase()
    const matches: Array<{ start: number; end: number }> = []
    let index = normalizedText.indexOf(normalizedQuery)

    while (index !== -1) {
      matches.push({
        start: index,
        end: index + normalizedQuery.length,
      })
      index = normalizedText.indexOf(normalizedQuery, index + normalizedQuery.length)
    }

    if (matches.length === 0) {
      return null
    }

    return { matches }
  }
})
