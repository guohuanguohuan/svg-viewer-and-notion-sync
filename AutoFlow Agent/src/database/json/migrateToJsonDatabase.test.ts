import { App } from 'obsidian'

import { migrateToJsonDatabase } from './migrateToJsonDatabase'

const mockAdapter = {
  exists: jest.fn(),
  write: jest.fn(),
}

const mockVault = {
  adapter: mockAdapter,
}

const mockApp = {
  vault: mockVault,
} as unknown as App

describe('migrateToJsonDatabase', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should skip database initialization after the migration marker exists', async () => {
    mockAdapter.exists.mockResolvedValue(true)
    const getDbManager = jest.fn()

    await migrateToJsonDatabase(mockApp, getDbManager)

    expect(getDbManager).not.toHaveBeenCalled()
  })
})
