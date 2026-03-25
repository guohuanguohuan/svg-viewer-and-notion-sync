import { migrateFrom16To17 } from './16_to_17'

describe('Migration from v16 to v17', () => {
  it('should increment version to 17 and remove embedding settings', () => {
    const oldSettings = {
      version: 16,
      embeddingModels: [
        {
          providerType: 'openai',
          providerId: 'openai',
          id: 'openai/text-embedding-3-small',
          model: 'text-embedding-3-small',
          dimension: 1536,
        },
      ],
      embeddingModelId: 'openai/text-embedding-3-small',
      chatModelId: 'gpt-5.2',
    }

    const result = migrateFrom16To17(oldSettings)

    expect(result.version).toBe(17)
    expect('embeddingModels' in result).toBe(false)
    expect('embeddingModelId' in result).toBe(false)
    expect(result.chatModelId).toBe('gpt-5.2')
  })
})
