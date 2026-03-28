import { App, Notice } from 'obsidian'
import { useState } from 'react'

import { PLAN_PROVIDER_TYPES, PROVIDER_TYPES_INFO } from '../../../constants'
import SmartComposerPlugin from '../../../main'
import {
  LLMProvider,
  LLMProviderType,
  llmProviderSchema,
} from '../../../types/provider.types'
import { ObsidianButton } from '../../common/ObsidianButton'
import { ObsidianDropdown } from '../../common/ObsidianDropdown'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianTextInput } from '../../common/ObsidianTextInput'
import { ObsidianToggle } from '../../common/ObsidianToggle'
import { ReactModal } from '../../common/ReactModal'

type ProviderFormComponentProps = {
  plugin: SmartComposerPlugin
  provider: LLMProvider | null
  onClose: () => void
}

export class AddProviderModal extends ReactModal<ProviderFormComponentProps> {
  constructor(app: App, plugin: SmartComposerPlugin) {
    super({
      app,
      Component: ProviderFormComponent,
      props: { plugin, provider: null },
      options: {
        title: '添加自定义服务商',
      },
    })
  }
}

export class EditProviderModal extends ReactModal<ProviderFormComponentProps> {
  constructor(app: App, plugin: SmartComposerPlugin, provider: LLMProvider) {
    super({
      app,
      Component: ProviderFormComponent,
      props: { plugin, provider },
      options: {
        title: `编辑服务商：${provider.id}`,
      },
    })
  }
}

function ProviderFormComponent({
  plugin,
  provider,
  onClose,
}: ProviderFormComponentProps) {
  const [formData, setFormData] = useState<LLMProvider>(
    provider
      ? { ...provider }
      : {
          type: 'openai-compatible',
          id: '',
          apiKey: '',
          baseUrl: '',
        },
  )

  const handleSubmit = async () => {
    if (provider) {
      const newProviders = [...plugin.settings.providers]
      const currentProviderIndex = newProviders.findIndex(
        (v) => v.id === formData.id,
      )

      if (currentProviderIndex === -1) {
        new Notice('没有找到这个服务商 ID')
        return
      }

      const validationResult = llmProviderSchema.safeParse(formData)
      if (!validationResult.success) {
        new Notice(
          validationResult.error.issues.map((v) => v.message).join('\n'),
        )
        return
      }

      await plugin.setSettings({
        ...plugin.settings,
        providers: [
          ...plugin.settings.providers.slice(0, currentProviderIndex),
          formData,
          ...plugin.settings.providers.slice(currentProviderIndex + 1),
        ],
      })
    } else {
      if (
        plugin.settings.providers.some((p: LLMProvider) => p.id === formData.id)
      ) {
        new Notice('这个服务商 ID 已存在，请换一个。')
        return
      }

      const validationResult = llmProviderSchema.safeParse(formData)
      if (!validationResult.success) {
        new Notice(
          validationResult.error.issues.map((v) => v.message).join('\n'),
        )
        return
      }

      await plugin.setSettings({
        ...plugin.settings,
        providers: [...plugin.settings.providers, formData],
      })
    }

    onClose()
  }

  const providerTypeInfo = PROVIDER_TYPES_INFO[formData.type]

  return (
    <>
      {!provider && (
        <>
          <ObsidianSetting
            name="ID"
            desc="用于在设置中标识这个服务商，仅供你自己引用。"
            required
          >
            <ObsidianTextInput
              value={formData.id}
              placeholder="my-custom-provider"
              onChange={(value: string) =>
                setFormData((prev) => ({ ...prev, id: value }))
              }
            />
          </ObsidianSetting>

          <ObsidianSetting name="服务商类型" required>
            <ObsidianDropdown
              value={formData.type}
              options={Object.fromEntries(
                Object.entries(PROVIDER_TYPES_INFO)
                  .filter(
                    ([key]) =>
                      !PLAN_PROVIDER_TYPES.includes(key as LLMProviderType),
                  )
                  .map(([key, info]) => [key, info.label]),
              )}
              onChange={(value: string) =>
                setFormData(
                  (prev) =>
                    ({
                      ...prev,
                      type: value,
                      additionalSettings: {},
                    }) as LLMProvider,
                )
              }
            />
          </ObsidianSetting>
        </>
      )}

      {!PLAN_PROVIDER_TYPES.includes(formData.type) && (
        <>
          <ObsidianSetting
            name="API Key"
            desc="如果不需要，可以留空。"
            required={providerTypeInfo.requireApiKey}
          >
            <ObsidianTextInput
              value={formData.apiKey ?? ''}
              placeholder="输入你的 API Key"
              onChange={(value: string) =>
                setFormData((prev) => ({ ...prev, apiKey: value }))
              }
            />
          </ObsidianSetting>

          <ObsidianSetting
            name="Base URL"
            desc="如果使用默认地址，可以留空。"
            required={providerTypeInfo.requireBaseUrl}
          >
            <ObsidianTextInput
              value={formData.baseUrl ?? ''}
              placeholder="输入 Base URL"
              onChange={(value: string) =>
                setFormData((prev) => ({ ...prev, baseUrl: value }))
              }
            />
          </ObsidianSetting>
        </>
      )}

      {providerTypeInfo.additionalSettings.map((setting) => (
        <ObsidianSetting
          key={setting.key}
          name={setting.label}
          desc={'description' in setting ? setting.description : undefined}
          required={setting.required}
        >
          {setting.type === 'toggle' ? (
            <ObsidianToggle
              value={
                (formData.additionalSettings as Record<string, boolean>)?.[
                  setting.key
                ] ?? false
              }
              onChange={(value: boolean) =>
                setFormData(
                  (prev) =>
                    ({
                      ...prev,
                      additionalSettings: {
                        ...(prev.additionalSettings ?? {}),
                        [setting.key]: value,
                      },
                    }) as LLMProvider,
                )
              }
            />
          ) : (
            <ObsidianTextInput
              value={
                (formData.additionalSettings as Record<string, string>)?.[
                  setting.key
                ] ?? ''
              }
              placeholder={setting.placeholder}
              onChange={(value: string) =>
                setFormData(
                  (prev) =>
                    ({
                      ...prev,
                      additionalSettings: {
                        ...(prev.additionalSettings ?? {}),
                        [setting.key]: value,
                      },
                    }) as LLMProvider,
                )
              }
            />
          )}
        </ObsidianSetting>
      ))}

      <ObsidianSetting>
        <ObsidianButton
          text={provider ? '保存' : '添加'}
          onClick={handleSubmit}
          cta
        />
        <ObsidianButton text="取消" onClick={onClose} />
      </ObsidianSetting>
    </>
  )
}
