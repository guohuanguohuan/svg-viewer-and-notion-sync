import { App, Notice } from 'obsidian'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { useSettings } from '../../../contexts/settings-context'
import SmartComposerPlugin from '../../../main'
import { llmProviderSchema } from '../../../types/provider.types'
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
          message: `Duplicate provider id: ${provider.id}`,
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

  return 'Invalid JSON.'
}

export function ProvidersSection(_props: ProvidersSectionProps) {
  const { settings, setSettings } = useSettings()
  const [draft, setDraft] = useState('')
  const [validationMessage, setValidationMessage] = useState('')

  useEffect(() => {
    setDraft(JSON.stringify(settings.providers, null, 2))
    setValidationMessage('')
  }, [settings.providers])

  const handleSave = async () => {
    try {
      const parsed = JSON.parse(draft)
      const providers = providersJsonSchema.parse(parsed)
      const providerIds = new Set(providers.map((provider) => provider.id))

      const missingChatProviders = settings.chatModels
        .filter((model) => !providerIds.has(model.providerId))
        .map((model) => `${model.id} -> ${model.providerId}`)

      if (missingChatProviders.length > 0) {
        throw new Error(
          `These chat/apply models reference missing providers:\n${missingChatProviders.join('\n')}`,
        )
      }

      await setSettings({
        ...settings,
        providers,
      })
      setDraft(JSON.stringify(providers, null, 2))
      setValidationMessage('Saved providers JSON.')
      new Notice('Providers JSON saved')
    } catch (error) {
      setValidationMessage(formatJsonError(error))
    }
  }

  const handleReset = () => {
    setDraft(JSON.stringify(settings.providers, null, 2))
    setValidationMessage('')
  }

  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-header">Providers</div>

      <div className="smtcmp-settings-desc">
        <span>Manually edit provider config as JSON.</span>
        <br />
        This data is persisted in the plugin&apos;s <code>data.json</code>.
      </div>

      <ObsidianSetting className="smtcmp-settings-textarea smtcmp-settings-json-textarea">
        <ObsidianTextArea
          value={draft}
          placeholder='[{"type":"openai","id":"openai","apiKey":"sk-..."}]'
          onChange={setDraft}
        />
      </ObsidianSetting>

      <div className="smtcmp-settings-json-actions">
        <button className="mod-cta" onClick={() => void handleSave()}>
          Save JSON
        </button>
        <button onClick={handleReset}>Reset</button>
      </div>

      {validationMessage && (
        <div className="smtcmp-settings-json-validation">
          {validationMessage}
        </div>
      )}
    </div>
  )
}
