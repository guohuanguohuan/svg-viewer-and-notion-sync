import { App, Notice } from 'obsidian'
import { useState } from 'react'

import { DEFAULT_PROVIDERS } from '../../../constants'
import SmartComposerPlugin from '../../../main'
import { ChatModel, chatModelSchema } from '../../../types/chat-model.types'
import { PromptLevel } from '../../../types/prompt-level.types'
import { ObsidianButton } from '../../common/ObsidianButton'
import { ObsidianDropdown } from '../../common/ObsidianDropdown'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianTextInput } from '../../common/ObsidianTextInput'
import { ReactModal } from '../../common/ReactModal'

type AddChatModelModalComponentProps = {
  plugin: SmartComposerPlugin
  onClose: () => void
}

export class AddChatModelModal extends ReactModal<AddChatModelModalComponentProps> {
  constructor(app: App, plugin: SmartComposerPlugin) {
    super({
      app,
      Component: AddChatModelModalComponent,
      props: { plugin },
      options: {
        title: '添加自定义聊天模型',
      },
    })
  }
}

function AddChatModelModalComponent({
  plugin,
  onClose,
}: AddChatModelModalComponentProps) {
  const [formData, setFormData] = useState<ChatModel>({
    providerId: DEFAULT_PROVIDERS[0].id,
    providerType: DEFAULT_PROVIDERS[0].type,
    id: '',
    model: '',
    promptLevel: PromptLevel.Default,
  })

  const handleSubmit = async () => {
    if (plugin.settings.chatModels.some((p) => p.id === formData.id)) {
      new Notice('这个模型 ID 已存在，请换一个。')
      return
    }

    if (
      !plugin.settings.providers.some(
        (provider) => provider.id === formData.providerId,
      )
    ) {
      new Notice('对应的服务商 ID 不存在')
      return
    }

    const validationResult = chatModelSchema.safeParse(formData)
    if (!validationResult.success) {
      new Notice(validationResult.error.issues.map((v) => v.message).join('\n'))
      return
    }

    await plugin.setSettings({
      ...plugin.settings,
      chatModels: [...plugin.settings.chatModels, formData],
    })

    onClose()
  }

  return (
    <>
      <ObsidianSetting
        name="模型 ID"
        desc="用于在设置中标识这个模型，仅供你自己引用。"
        required
      >
        <ObsidianTextInput
          value={formData.id}
          placeholder="my-custom-model"
          onChange={(value: string) =>
            setFormData((prev) => ({ ...prev, id: value }))
          }
        />
      </ObsidianSetting>

      <ObsidianSetting
        name="服务商 ID"
        desc="选择这个模型对应的服务商。"
        required
      >
        <ObsidianDropdown
          value={formData.providerId}
          options={Object.fromEntries(
            plugin.settings.providers.map((provider) => [
              provider.id,
              provider.id,
            ]),
          )}
          onChange={(value: string) => {
            const provider = plugin.settings.providers.find(
              (p) => p.id === value,
            )
            if (!provider) {
              new Notice(`未找到服务商：${value}`)
              return
            }
            setFormData(
              (prev) =>
                ({
                  ...prev,
                  providerId: value,
                  providerType: provider.type,
                }) as ChatModel,
            )
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name="模型名称"
        desc="填写模型的实际 API 名称。"
        required
      >
        <ObsidianTextInput
          value={formData.model}
          placeholder="例如：gpt-5.2"
          onChange={(value: string) =>
            setFormData((prev) => ({ ...prev, model: value }))
          }
        />
      </ObsidianSetting>

      <ObsidianSetting
        name="提示词级别"
        desc='控制系统提示词的复杂度。如果是容易“只复述指令”的小模型，建议选择“simple”。'
        required
      >
        <ObsidianDropdown
          value={(formData.promptLevel ?? PromptLevel.Default).toString()}
          options={{
            [PromptLevel.Default]: 'default（默认）',
            [PromptLevel.Simple]: 'simple（简化）',
          }}
          onChange={(value: string) =>
            setFormData((prev) => ({
              ...prev,
              promptLevel: Number(value) as PromptLevel,
            }))
          }
        />
      </ObsidianSetting>

      <ObsidianSetting>
        <ObsidianButton text="添加" onClick={handleSubmit} cta />
        <ObsidianButton text="取消" onClick={onClose} />
      </ObsidianSetting>
    </>
  )
}
