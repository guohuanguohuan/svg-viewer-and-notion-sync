import { App, Notice } from 'obsidian'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { useSettings } from '../../../contexts/settings-context'
import { getChatModelClient } from '../../../core/llm/manager'
import SmartComposerPlugin from '../../../main'
import { SmartComposerSettings } from '../../../settings/schema/setting.types'
import { chatModelSchema } from '../../../types/chat-model.types'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianTextArea } from '../../common/ObsidianTextArea'
import { EmbeddingDbManageModal } from '../modals/EmbeddingDbManageModal'

type ModelsSectionProps = {
  app: App
  plugin: SmartComposerPlugin
}

const ragOptionsEditorSchema = z.object({
  chunkSize: z.number(),
  thresholdTokens: z.number(),
  minSimilarity: z.number(),
  limit: z.number(),
  excludePatterns: z.array(z.string()),
  includePatterns: z.array(z.string()),
})

const chatModelsJsonSchema = z
  .object({
    chatModels: z.array(chatModelSchema),
    chatModelId: z.string().min(1, 'chatModelId is required'),
  })
  .superRefine((value, ctx) => {
    const chatModelIds = new Set<string>()

    for (const model of value.chatModels) {
      if (chatModelIds.has(model.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate chat model id: ${model.id}`,
        })
      }
      chatModelIds.add(model.id)
    }

    if (!chatModelIds.has(value.chatModelId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['chatModelId'],
        message: 'chatModelId must match one of the chatModels ids',
      })
    }
  })

const applyModelJsonSchema = z.object({
  applyModelId: z.string().min(1, 'applyModelId is required'),
})

const retrievalJsonSchema = z.object({
  ragOptions: ragOptionsEditorSchema,
})

const formatJsonError = (error: unknown) => {
  if (error instanceof z.ZodError) {
    return error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
        return `${path}${issue.message}`
      })
      .join('\n')
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Invalid JSON.'
}

export function ModelsSection({ app, plugin }: ModelsSectionProps) {
  const { settings, setSettings } = useSettings()
  const [chatDraft, setChatDraft] = useState('')
  const [applyDraft, setApplyDraft] = useState('')
  const [retrievalDraft, setRetrievalDraft] = useState('')
  const [isTestingChat, setIsTestingChat] = useState(false)
  const [isTestingApply, setIsTestingApply] = useState(false)
  const [chatValidationMessage, setChatValidationMessage] = useState('')
  const [applyValidationMessage, setApplyValidationMessage] = useState('')
  const [retrievalValidationMessage, setRetrievalValidationMessage] =
    useState('')

  useEffect(() => {
    setChatDraft(
      JSON.stringify(
        {
          chatModels: settings.chatModels,
          chatModelId: settings.chatModelId,
        },
        null,
        2,
      ),
    )
    setChatValidationMessage('')
  }, [settings.chatModels, settings.chatModelId])

  useEffect(() => {
    setApplyDraft(
      JSON.stringify(
        {
          applyModelId: settings.applyModelId,
        },
        null,
        2,
      ),
    )
    setApplyValidationMessage('')
  }, [settings.applyModelId])

  useEffect(() => {
    setRetrievalDraft(
      JSON.stringify(
        {
          ragOptions: settings.ragOptions,
        },
        null,
        2,
      ),
    )
    setRetrievalValidationMessage('')
  }, [settings.ragOptions])

  const validateModelProviders = (
    models: { id: string; providerId: string }[],
    label: string,
    baseSettings: SmartComposerSettings = settings,
  ) => {
    const providerIds = new Set(
      baseSettings.providers.map((provider) => provider.id),
    )
    const missingProviders = models
      .filter((model) => !providerIds.has(model.providerId))
      .map((model) => `${model.id} -> ${model.providerId}`)

    if (missingProviders.length > 0) {
      throw new Error(
        `These ${label} reference missing providers:\n${missingProviders.join('\n')}`,
      )
    }
  }

  const testChatConnection = async () => {
    try {
      setIsTestingChat(true)
      const parsed = JSON.parse(chatDraft)
      const chatConfig = chatModelsJsonSchema.parse(parsed)
      validateModelProviders(chatConfig.chatModels, 'chat models')

      const tempSettings: SmartComposerSettings = {
        ...settings,
        chatModels: chatConfig.chatModels,
        chatModelId: chatConfig.chatModelId,
      }

      const { providerClient, model } = getChatModelClient({
        modelId: chatConfig.chatModelId,
        settings: tempSettings,
        setSettings,
      })

      await providerClient.generateResponse(
        model,
        {
          model: model.model,
          messages: [
            {
              role: 'user',
              content: 'Connection test. Reply with OK only.',
            },
          ],
          stream: false,
          max_tokens: 16,
        },
        {},
      )

      new Notice(`Chat model connection succeeded: ${chatConfig.chatModelId}`)
    } catch (error) {
      setChatValidationMessage(formatJsonError(error))
    } finally {
      setIsTestingChat(false)
    }
  }

  const testApplyConnection = async () => {
    try {
      setIsTestingApply(true)
      const parsed = JSON.parse(applyDraft)
      const applyConfig = applyModelJsonSchema.parse(parsed)

      if (
        !settings.chatModels.some((model) => model.id === applyConfig.applyModelId)
      ) {
        throw new Error(
          'applyModelId must match one of the current chatModels ids.',
        )
      }

      const tempSettings: SmartComposerSettings = {
        ...settings,
        applyModelId: applyConfig.applyModelId,
      }

      const { providerClient, model } = getChatModelClient({
        modelId: applyConfig.applyModelId,
        settings: tempSettings,
        setSettings,
      })

      await providerClient.generateResponse(
        model,
        {
          model: model.model,
          messages: [
            {
              role: 'user',
              content: 'Connection test. Reply with OK only.',
            },
          ],
          stream: false,
          max_tokens: 16,
        },
        {},
      )

      new Notice(`Apply model connection succeeded: ${applyConfig.applyModelId}`)
    } catch (error) {
      setApplyValidationMessage(formatJsonError(error))
    } finally {
      setIsTestingApply(false)
    }
  }

  const handleSaveChatJson = async () => {
    try {
      const parsed = JSON.parse(chatDraft)
      const chatConfig = chatModelsJsonSchema.parse(parsed)
      validateModelProviders(chatConfig.chatModels, 'chat models')

      if (
        !chatConfig.chatModels.some((model) => model.id === settings.applyModelId)
      ) {
        throw new Error(
          'Current applyModelId is no longer present in chatModels. Update the apply model JSON after changing chatModels.',
        )
      }

      await setSettings({
        ...settings,
        chatModels: chatConfig.chatModels,
        chatModelId: chatConfig.chatModelId,
      })
      setChatDraft(JSON.stringify(chatConfig, null, 2))
      setChatValidationMessage('Saved chat model JSON.')
      new Notice('Chat model JSON saved')
    } catch (error) {
      setChatValidationMessage(formatJsonError(error))
    }
  }

  const handleSaveApplyJson = async () => {
    try {
      const parsed = JSON.parse(applyDraft)
      const applyConfig = applyModelJsonSchema.parse(parsed)

      if (
        !settings.chatModels.some((model) => model.id === applyConfig.applyModelId)
      ) {
        throw new Error(
          'applyModelId must match one of the current chatModels ids.',
        )
      }

      await setSettings({
        ...settings,
        applyModelId: applyConfig.applyModelId,
      })
      setApplyDraft(JSON.stringify(applyConfig, null, 2))
      setApplyValidationMessage('Saved apply model JSON.')
      new Notice('Apply model JSON saved')
    } catch (error) {
      setApplyValidationMessage(formatJsonError(error))
    }
  }

  const handleSaveRetrievalJson = async () => {
    try {
      const parsed = JSON.parse(retrievalDraft)
      const retrievalConfig = retrievalJsonSchema.parse(parsed)

      await setSettings({
        ...settings,
        ragOptions: retrievalConfig.ragOptions,
      })
      setRetrievalDraft(JSON.stringify(retrievalConfig, null, 2))
      setRetrievalValidationMessage('Saved retrieval settings JSON.')
      new Notice('Retrieval settings JSON saved')
    } catch (error) {
      setRetrievalValidationMessage(formatJsonError(error))
    }
  }

  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-header">Models</div>

      <div className="smtcmp-settings-desc">
        Keep chat models, apply model, and search-based RAG settings here.
        <br />
        Local embedding configs have been removed from the mainline
        architecture, so new features should not depend on vector indexing.
      </div>

      <div className="smtcmp-settings-json-panel">
        <div className="smtcmp-settings-sub-header">Chat model JSON</div>
        <div className="smtcmp-settings-desc">
          Edit <code>chatModels</code> and the current <code>chatModelId</code>.
        </div>
        <ObsidianSetting className="smtcmp-settings-textarea smtcmp-settings-json-textarea">
          <ObsidianTextArea
            value={chatDraft}
            placeholder='{"chatModels":[],"chatModelId":""}'
            onChange={setChatDraft}
          />
        </ObsidianSetting>
        <div className="smtcmp-settings-json-actions">
          <button className="mod-cta" onClick={() => void handleSaveChatJson()}>
            Save
          </button>
          <button
            onClick={() => void testChatConnection()}
            disabled={isTestingChat}
          >
            {isTestingChat ? 'Testing...' : 'Test connection'}
          </button>
          <button
            className="smtcmp-settings-json-reset"
            onClick={() =>
              setChatDraft(
                JSON.stringify(
                  {
                    chatModels: settings.chatModels,
                    chatModelId: settings.chatModelId,
                  },
                  null,
                  2,
                ),
              )
            }
          >
            Reset
          </button>
        </div>
        {chatValidationMessage && (
          <div className="smtcmp-settings-json-validation">
            {chatValidationMessage}
          </div>
        )}
      </div>

      <div className="smtcmp-settings-json-panel">
        <div className="smtcmp-settings-sub-header">Apply model JSON</div>
        <div className="smtcmp-settings-desc">
          Only edit <code>applyModelId</code> here. It must point to an existing
          model from <code>chatModels</code>.
        </div>
        <ObsidianSetting className="smtcmp-settings-textarea smtcmp-settings-json-textarea">
          <ObsidianTextArea
            value={applyDraft}
            placeholder='{"applyModelId":""}'
            onChange={setApplyDraft}
          />
        </ObsidianSetting>
        <div className="smtcmp-settings-json-actions">
          <button
            className="mod-cta"
            onClick={() => void handleSaveApplyJson()}
          >
            Save
          </button>
          <button
            onClick={() => void testApplyConnection()}
            disabled={isTestingApply}
          >
            {isTestingApply ? 'Testing...' : 'Test connection'}
          </button>
          <button
            className="smtcmp-settings-json-reset"
            onClick={() =>
              setApplyDraft(
                JSON.stringify(
                  {
                    applyModelId: settings.applyModelId,
                  },
                  null,
                  2,
                ),
              )
            }
          >
            Reset
          </button>
        </div>
        {applyValidationMessage && (
          <div className="smtcmp-settings-json-validation">
            {applyValidationMessage}
          </div>
        )}
      </div>

      <div className="smtcmp-settings-json-panel">
        <div className="smtcmp-settings-sub-header">Retrieval settings JSON</div>
        <div className="smtcmp-settings-desc">
          Search-based RAG now keeps only <code>ragOptions</code>.
          <br />
          <code>chunkSize</code> controls snippet length, <code>thresholdTokens</code>{' '}
          controls when we switch from direct file reads to search-based retrieval,
          and <code>minSimilarity</code> is temporarily reused as the minimum search
          score threshold.
        </div>
        <ObsidianSetting className="smtcmp-settings-textarea smtcmp-settings-json-textarea">
          <ObsidianTextArea
            value={retrievalDraft}
            placeholder={`{
  "ragOptions": {
    "chunkSize": 1000,
    "thresholdTokens": 8192,
    "minSimilarity": 0,
    "limit": 10,
    "excludePatterns": [],
    "includePatterns": []
  }
}`}
            onChange={setRetrievalDraft}
          />
        </ObsidianSetting>
        <div className="smtcmp-settings-json-actions">
          <button
            className="mod-cta"
            onClick={() => void handleSaveRetrievalJson()}
          >
            Save
          </button>
          <button onClick={() => new EmbeddingDbManageModal(app, plugin).open()}>
            Legacy vector note
          </button>
          <button
            className="smtcmp-settings-json-reset"
            onClick={() =>
              setRetrievalDraft(
                JSON.stringify(
                  {
                    ragOptions: settings.ragOptions,
                  },
                  null,
                  2,
                ),
              )
            }
          >
            Reset
          </button>
        </div>
        {retrievalValidationMessage && (
          <div className="smtcmp-settings-json-validation">
            {retrievalValidationMessage}
          </div>
        )}
      </div>
    </div>
  )
}
