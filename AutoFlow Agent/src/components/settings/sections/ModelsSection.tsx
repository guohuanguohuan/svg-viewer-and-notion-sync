import { App, Notice } from 'obsidian'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { useSettings } from '../../../contexts/settings-context'
import { getChatModelClient } from '../../../core/llm/manager'
import SmartComposerPlugin from '../../../main'
import { SmartComposerSettings } from '../../../settings/schema/setting.types'
import { chatModelSchema } from '../../../types/chat-model.types'
import { parseJsonWithComments } from '../../../utils/json-with-comments'
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
    chatModelId: z.string().min(1, 'chatModelId 不能为空'),
  })
  .superRefine((value, ctx) => {
    const chatModelIds = new Set<string>()

    for (const model of value.chatModels) {
      if (chatModelIds.has(model.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `存在重复的模型 ID：${model.id}`,
        })
      }
      chatModelIds.add(model.id)
    }

    if (!chatModelIds.has(value.chatModelId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['chatModelId'],
        message: 'chatModelId 必须对应 chatModels 中某个已经存在的模型 ID',
      })
    }
  })

const applyModelJsonSchema = z.object({
  applyModelId: z.string().min(1, 'applyModelId 不能为空'),
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

  return 'JSON 格式无效。'
}

function indentMultilineJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
    .split('\n')
    .map((line, index) => (index === 0 ? line : `  ${line}`))
    .join('\n')
}

function buildChatDraft(settings: SmartComposerSettings): string {
  return `{
  // chatModels: 聊天和执行共用的模型列表
  "chatModels": ${indentMultilineJson(settings.chatModels)},
  // chatModelId: 当前默认聊天模型的 ID，必须与上面某个模型的 id 一致
  "chatModelId": ${JSON.stringify(settings.chatModelId)}
}`
}

function buildApplyDraft(settings: SmartComposerSettings): string {
  return `{
  // applyModelId: 用于应用改写或写回的模型 ID，必须与 chatModels 中某个模型的 id 一致
  "applyModelId": ${JSON.stringify(settings.applyModelId)}
}`
}

function buildRetrievalDraft(settings: SmartComposerSettings): string {
  return `{
  // ragOptions: 检索相关配置
  "ragOptions": {
    // chunkSize: 单个候选片段的目标长度
    "chunkSize": ${settings.ragOptions.chunkSize},
    // thresholdTokens: 达到这个 token 规模后，优先走检索而不是整文件直读
    "thresholdTokens": ${settings.ragOptions.thresholdTokens},
    // minSimilarity: 当前搜索结果的最低命中分数阈值
    "minSimilarity": ${settings.ragOptions.minSimilarity},
    // limit: 最多返回多少条相关片段
    "limit": ${settings.ragOptions.limit},
    // excludePatterns: 需要排除的文件匹配规则
    "excludePatterns": ${indentMultilineJson(settings.ragOptions.excludePatterns)},
    // includePatterns: 如果不为空，只在这些匹配规则中检索
    "includePatterns": ${indentMultilineJson(settings.ragOptions.includePatterns)}
  }
}`
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
    setChatDraft(buildChatDraft(settings))
    setChatValidationMessage('')
  }, [settings.chatModels, settings.chatModelId])

  useEffect(() => {
    setApplyDraft(buildApplyDraft(settings))
    setApplyValidationMessage('')
  }, [settings.applyModelId])

  useEffect(() => {
    setRetrievalDraft(buildRetrievalDraft(settings))
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
        `以下${label}引用了不存在的服务商：\n${missingProviders.join('\n')}`,
      )
    }
  }

  const testChatConnection = async () => {
    try {
      setIsTestingChat(true)
      const parsed = parseJsonWithComments<unknown>(chatDraft)
      const chatConfig = chatModelsJsonSchema.parse(parsed)
      validateModelProviders(chatConfig.chatModels, '聊天模型')

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
              content: '连接测试。只回复 OK。',
            },
          ],
          stream: false,
          max_tokens: 16,
        },
        {},
      )

      new Notice(`聊天模型连接成功：${chatConfig.chatModelId}`)
    } catch (error) {
      setChatValidationMessage(formatJsonError(error))
    } finally {
      setIsTestingChat(false)
    }
  }

  const testApplyConnection = async () => {
    try {
      setIsTestingApply(true)
      const parsed = parseJsonWithComments<unknown>(applyDraft)
      const applyConfig = applyModelJsonSchema.parse(parsed)

      if (
        !settings.chatModels.some(
          (model) => model.id === applyConfig.applyModelId,
        )
      ) {
        throw new Error(
          'applyModelId 必须对应当前 chatModels 中某个已经存在的模型 ID。',
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
              content: '连接测试。只回复 OK。',
            },
          ],
          stream: false,
          max_tokens: 16,
        },
        {},
      )

      new Notice(`执行模型连接成功：${applyConfig.applyModelId}`)
    } catch (error) {
      setApplyValidationMessage(formatJsonError(error))
    } finally {
      setIsTestingApply(false)
    }
  }

  const handleSaveChatJson = async () => {
    try {
      const parsed = parseJsonWithComments<unknown>(chatDraft)
      const chatConfig = chatModelsJsonSchema.parse(parsed)
      validateModelProviders(chatConfig.chatModels, '聊天模型')

      if (
        !chatConfig.chatModels.some(
          (model) => model.id === settings.applyModelId,
        )
      ) {
        throw new Error(
          '当前 applyModelId 已不在 chatModels 中。修改 chatModels 后，请同步调整执行模型 JSON。',
        )
      }

      await setSettings({
        ...settings,
        chatModels: chatConfig.chatModels,
        chatModelId: chatConfig.chatModelId,
      })
      setChatDraft(buildChatDraft({ ...settings, ...chatConfig }))
      setChatValidationMessage('聊天模型 JSON 已保存。')
      new Notice('聊天模型 JSON 已保存')
    } catch (error) {
      setChatValidationMessage(formatJsonError(error))
    }
  }

  const handleSaveApplyJson = async () => {
    try {
      const parsed = parseJsonWithComments<unknown>(applyDraft)
      const applyConfig = applyModelJsonSchema.parse(parsed)

      if (
        !settings.chatModels.some(
          (model) => model.id === applyConfig.applyModelId,
        )
      ) {
        throw new Error(
          'applyModelId 必须对应当前 chatModels 中某个已经存在的模型 ID。',
        )
      }

      await setSettings({
        ...settings,
        applyModelId: applyConfig.applyModelId,
      })
      setApplyDraft(buildApplyDraft({ ...settings, ...applyConfig }))
      setApplyValidationMessage('执行模型 JSON 已保存。')
      new Notice('执行模型 JSON 已保存')
    } catch (error) {
      setApplyValidationMessage(formatJsonError(error))
    }
  }

  const handleSaveRetrievalJson = async () => {
    try {
      const parsed = parseJsonWithComments<unknown>(retrievalDraft)
      const retrievalConfig = retrievalJsonSchema.parse(parsed)

      await setSettings({
        ...settings,
        ragOptions: retrievalConfig.ragOptions,
      })
      setRetrievalDraft(
        buildRetrievalDraft({
          ...settings,
          ragOptions: retrievalConfig.ragOptions,
        }),
      )
      setRetrievalValidationMessage('检索设置 JSON 已保存。')
      new Notice('检索设置 JSON 已保存')
    } catch (error) {
      setRetrievalValidationMessage(formatJsonError(error))
    }
  }

  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-header">模型设置</div>

      <div className="smtcmp-settings-desc">
        这里统一管理聊天模型、执行模型，以及基于搜索的 RAG 检索配置。
        <br />
        旧的本地 embedding / 向量索引链路已经退出主线架构，新功能不要再依赖它。
      </div>

      <div className="smtcmp-settings-json-panel">
        <div className="smtcmp-settings-sub-header">聊天模型 JSON</div>
        <div className="smtcmp-settings-desc">
          手动编辑 <code>chatModels</code> 和当前默认的{' '}
          <code>chatModelId</code>。
          <br />
          支持在 JSON 中使用 <code>// 中文注释</code>。
        </div>
        <ObsidianSetting className="smtcmp-settings-textarea smtcmp-settings-json-textarea">
          <ObsidianTextArea
            value={chatDraft}
            placeholder={buildChatDraft({
              ...settings,
              chatModels: [],
              chatModelId: '',
            })}
            onChange={setChatDraft}
          />
        </ObsidianSetting>
        <div className="smtcmp-settings-json-actions">
          <button className="mod-cta" onClick={() => void handleSaveChatJson()}>
            保存
          </button>
          <button
            onClick={() => void testChatConnection()}
            disabled={isTestingChat}
          >
            {isTestingChat ? '测试中...' : '测试连接'}
          </button>
          <button
            className="smtcmp-settings-json-reset"
            onClick={() => setChatDraft(buildChatDraft(settings))}
          >
            重置
          </button>
        </div>
        {chatValidationMessage && (
          <div className="smtcmp-settings-json-validation">
            {chatValidationMessage}
          </div>
        )}
      </div>

      <div className="smtcmp-settings-json-panel">
        <div className="smtcmp-settings-sub-header">执行模型 JSON</div>
        <div className="smtcmp-settings-desc">
          这里专门编辑 <code>applyModelId</code>。
          <br />
          它必须指向 <code>chatModels</code> 中某个已经存在的模型 ID，并支持{' '}
          <code>// 中文注释</code>。
        </div>
        <ObsidianSetting className="smtcmp-settings-textarea smtcmp-settings-json-textarea">
          <ObsidianTextArea
            value={applyDraft}
            placeholder={buildApplyDraft({
              ...settings,
              applyModelId: '',
            })}
            onChange={setApplyDraft}
          />
        </ObsidianSetting>
        <div className="smtcmp-settings-json-actions">
          <button
            className="mod-cta"
            onClick={() => void handleSaveApplyJson()}
          >
            保存
          </button>
          <button
            onClick={() => void testApplyConnection()}
            disabled={isTestingApply}
          >
            {isTestingApply ? '测试中...' : '测试连接'}
          </button>
          <button
            className="smtcmp-settings-json-reset"
            onClick={() => setApplyDraft(buildApplyDraft(settings))}
          >
            重置
          </button>
        </div>
        {applyValidationMessage && (
          <div className="smtcmp-settings-json-validation">
            {applyValidationMessage}
          </div>
        )}
      </div>

      <div className="smtcmp-settings-json-panel">
        <div className="smtcmp-settings-sub-header">检索设置 JSON</div>
        <div className="smtcmp-settings-desc">
          搜索型 RAG 现在只保留 <code>ragOptions</code>。
          <br />
          <code>chunkSize</code> 控制候选片段长度，<code>thresholdTokens</code>{' '}
          控制何时从整文件直读切换到检索模式，<code>minSimilarity</code>{' '}
          用作最低命中分数阈值。
          <br />
          这里同样支持 <code>// 中文注释</code>。
        </div>
        <ObsidianSetting className="smtcmp-settings-textarea smtcmp-settings-json-textarea">
          <ObsidianTextArea
            value={retrievalDraft}
            placeholder={buildRetrievalDraft(settings)}
            onChange={setRetrievalDraft}
          />
        </ObsidianSetting>
        <div className="smtcmp-settings-json-actions">
          <button
            className="mod-cta"
            onClick={() => void handleSaveRetrievalJson()}
          >
            保存
          </button>
          <button onClick={() => new EmbeddingDbManageModal(app, plugin).open()}>
            旧向量说明
          </button>
          <button
            className="smtcmp-settings-json-reset"
            onClick={() => setRetrievalDraft(buildRetrievalDraft(settings))}
          >
            重置
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
