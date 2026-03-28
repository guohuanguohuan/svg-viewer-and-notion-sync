import { App, Notice } from 'obsidian'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { useSettings } from '../../../contexts/settings-context'
import SmartComposerPlugin from '../../../main'
import { llmProviderSchema } from '../../../types/provider.types'
import { parseJsonWithComments } from '../../../utils/json-with-comments'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianTextArea } from '../../common/ObsidianTextArea'

type ProvidersSectionProps = {
  app: App
  plugin: SmartComposerPlugin
}

const providersJsonSchema = z
  .array(llmProviderSchema)
  .superRefine((providers, ctx) => {
    const providerIds = new Set<string>()

    for (const provider of providers) {
      if (providerIds.has(provider.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `存在重复的服务商 id：${provider.id}`,
        })
      }
      providerIds.add(provider.id)
    }
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

function buildProvidersDraft(providers: unknown): string {
  const content = indentMultilineJson(providers)

  if (content === '[]') {
    return `[
  // 每个元素都是一个服务商配置对象
  // type: 服务商类型，例如 "openai"、"anthropic"、"gemini"
  // id: 服务商的唯一标识，chatModels 会通过 providerId 引用它
  // apiKey: 对应平台的密钥
  // baseUrl: 自定义接口地址，可选
  // additionalSettings: 某些服务商的额外参数，可选
]`
  }

  return `[
  // 每个元素都是一个服务商配置对象
  // type: 服务商类型，例如 "openai"、"anthropic"、"gemini"
  // id: 服务商的唯一标识，chatModels 会通过 providerId 引用它
  // apiKey: 对应平台的密钥
  // baseUrl: 自定义接口地址，可选
  // additionalSettings: 某些服务商的额外参数，可选
  ${content.slice(2, -2)}
]`
}

export function ProvidersSection(_props: ProvidersSectionProps) {
  const { settings, setSettings } = useSettings()
  const [draft, setDraft] = useState('')
  const [validationMessage, setValidationMessage] = useState('')

  useEffect(() => {
    setDraft(buildProvidersDraft(settings.providers))
    setValidationMessage('')
  }, [settings.providers])

  const handleSave = async () => {
    try {
      const parsed = parseJsonWithComments(draft)
      const providers = providersJsonSchema.parse(parsed)
      const providerIds = new Set(providers.map((provider) => provider.id))

      const missingChatProviders = settings.chatModels
        .filter((model) => !providerIds.has(model.providerId))
        .map((model) => `${model.id} -> ${model.providerId}`)

      if (missingChatProviders.length > 0) {
        throw new Error(
          `以下聊天/执行模型引用了不存在的服务商：\n${missingChatProviders.join('\n')}`,
        )
      }

      await setSettings({
        ...settings,
        providers,
      })
      setDraft(buildProvidersDraft(providers))
      setValidationMessage('服务商 JSON 已保存。')
      new Notice('服务商 JSON 已保存')
    } catch (error) {
      setValidationMessage(formatJsonError(error))
    }
  }

  const handleReset = () => {
    setDraft(buildProvidersDraft(settings.providers))
    setValidationMessage('')
  }

  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-header">服务商配置</div>

      <div className="smtcmp-settings-desc">
        在这里手动编辑服务商配置 JSON。
        <br />
        支持使用 <code>// 中文注释</code>，保存后会写入插件的{' '}
        <code>data.json</code>。
      </div>

      <ObsidianSetting className="smtcmp-settings-textarea smtcmp-settings-json-textarea">
        <ObsidianTextArea
          value={draft}
          placeholder={buildProvidersDraft([
            {
              type: 'openai',
              id: 'openai',
              apiKey: 'sk-...',
            },
          ])}
          onChange={setDraft}
        />
      </ObsidianSetting>

      <div className="smtcmp-settings-json-actions">
        <button className="mod-cta" onClick={() => void handleSave()}>
          保存 JSON
        </button>
        <button onClick={handleReset}>重置</button>
      </div>

      {validationMessage && (
        <div className="smtcmp-settings-json-validation">
          {validationMessage}
        </div>
      )}
    </div>
  )
}
