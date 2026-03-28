import { ChevronDown, ChevronRight } from 'lucide-react'
import path from 'path-browserify'
import { useState } from 'react'

import { useApp } from '../../contexts/app-context'
import { VaultSearchResult } from '../../types/rag'
import { openMarkdownFile } from '../../utils/obsidian'

function SimiliartySearchItem({
  chunk,
}: {
  chunk: VaultSearchResult
}) {
  const app = useApp()

  const handleClick = () => {
    openMarkdownFile(app, chunk.path, chunk.metadata.startLine)
  }
  return (
    <div onClick={handleClick} className="smtcmp-similarity-search-item">
      <div className="smtcmp-similarity-search-item__similarity">
        {chunk.score.toFixed(2)}
      </div>
      <div className="smtcmp-similarity-search-item__path">
        {path.basename(chunk.path)}
      </div>
      <div className="smtcmp-similarity-search-item__line-numbers">
        {`${chunk.metadata.startLine} - ${chunk.metadata.endLine}`}
      </div>
    </div>
  )
}

export default function SimilaritySearchResults({
  similaritySearchResults,
}: {
  similaritySearchResults: VaultSearchResult[]
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="smtcmp-similarity-search-results">
      <div
        onClick={() => {
          setIsOpen(!isOpen)
        }}
        className="smtcmp-similarity-search-results__trigger"
      >
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <div>Show Referenced Documents ({similaritySearchResults.length})</div>
      </div>
      {isOpen && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {similaritySearchResults.map((chunk) => (
            <SimiliartySearchItem key={chunk.id} chunk={chunk} />
          ))}
        </div>
      )}
    </div>
  )
}
