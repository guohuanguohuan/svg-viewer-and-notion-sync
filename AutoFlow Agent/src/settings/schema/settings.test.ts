import {
  DEFAULT_APPLY_MODEL_ID,
  DEFAULT_CHAT_MODELS,
  DEFAULT_CHAT_MODEL_ID,
  DEFAULT_PROVIDERS,
} from '../../constants'

import { SETTINGS_SCHEMA_VERSION } from './migrations'
import { parseSmartComposerSettings } from './settings'

describe('parseSmartComposerSettings', () => {
  it('should return default values for empty input', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const result = parseSmartComposerSettings({})

    expect(result).toEqual({
      version: SETTINGS_SCHEMA_VERSION,

      providers: [...DEFAULT_PROVIDERS],

      chatModels: [...DEFAULT_CHAT_MODELS],

      chatModelId: DEFAULT_CHAT_MODEL_ID,
      applyModelId: DEFAULT_APPLY_MODEL_ID,

      systemPrompt: '',

      ragOptions: {
        chunkSize: 1000,
        thresholdTokens: 8192,
        minSimilarity: 0.0,
        limit: 10,
        excludePatterns: [],
        includePatterns: [],
      },

      mcp: {
        servers: [],
      },

      chatOptions: {
        includeCurrentFileContent: true,
        enableTools: true,
        maxAutoIterations: 1,
      },
    })
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('should drop legacy embedding fields', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const result = parseSmartComposerSettings({
      embeddingModels: [
        {
          providerType: 'openai',
          providerId: 'openai',
          id: 'legacy-model',
          model: 'text-embedding-3-small',
          dimension: 1536,
        },
      ],
      embeddingModelId: 'legacy-model',
    })

    expect('embeddingModels' in result).toBe(false)
    expect('embeddingModelId' in result).toBe(false)
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
