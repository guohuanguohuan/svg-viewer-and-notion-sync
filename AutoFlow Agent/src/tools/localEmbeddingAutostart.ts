import { Platform, requestUrl } from 'obsidian'

import { SmartComposerSettings } from '../settings/schema/setting.types'

const LOCAL_EMBEDDING_PROVIDER_ID = 'android-local-embedding'
const LOCAL_EMBEDDING_HEALTH_URL = 'http://127.0.0.1:8787/health'
const START_SCRIPT_NAME = 'start-local-embedding.ps1'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const getChildProcess = (): typeof import('child_process') | null => {
  try {
    return window.require?.('child_process') ?? null
  } catch {
    return null
  }
}

const getPathModule = (): typeof import('path') | null => {
  try {
    return window.require?.('path') ?? null
  } catch {
    return null
  }
}

export async function isLocalEmbeddingServiceHealthy(): Promise<boolean> {
  try {
    const response = await requestUrl({
      url: LOCAL_EMBEDDING_HEALTH_URL,
      method: 'GET',
      throw: false,
    })
    return response.status === 200
  } catch {
    return false
  }
}

export function shouldAutoStartLocalEmbeddingService(
  settings: SmartComposerSettings,
): boolean {
  const currentEmbeddingModel = settings.embeddingModels.find(
    (model) => model.id === settings.embeddingModelId,
  )
  if (!currentEmbeddingModel) {
    return false
  }

  if (
    currentEmbeddingModel.providerType !== 'openai-compatible' ||
    currentEmbeddingModel.providerId !== LOCAL_EMBEDDING_PROVIDER_ID
  ) {
    return false
  }

  const provider = settings.providers.find(
    (item) =>
      item.id === LOCAL_EMBEDDING_PROVIDER_ID &&
      item.type === 'openai-compatible',
  )

  return provider?.baseUrl?.startsWith('http://127.0.0.1:8787') ?? false
}

export async function ensureLocalEmbeddingService(
  pluginDir: string | undefined,
): Promise<boolean> {
  if (!Platform.isDesktop || !pluginDir) {
    return false
  }

  if (await isLocalEmbeddingServiceHealthy()) {
    return true
  }

  const childProcess = getChildProcess()
  const path = getPathModule()
  if (!childProcess || !path) {
    return false
  }

  const scriptPath = path.join(pluginDir, START_SCRIPT_NAME)

  try {
    const child = childProcess.spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      },
    )
    child.unref()
  } catch {
    return false
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    await sleep(1500)
    if (await isLocalEmbeddingServiceHealthy()) {
      return true
    }
  }

  return false
}
