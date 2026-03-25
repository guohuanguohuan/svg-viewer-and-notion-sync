import { App, Notice } from 'obsidian'

import { useSettings } from '../../../contexts/settings-context'
import SmartComposerPlugin from '../../../main'
import { smartComposerSettingsSchema } from '../../../settings/schema/setting.types'
import { ObsidianButton } from '../../common/ObsidianButton'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ConfirmModal } from '../../modals/ConfirmModal'

type EtcSectionProps = {
  app: App
  plugin: SmartComposerPlugin
}

export function EtcSection({ app }: EtcSectionProps) {
  const { setSettings } = useSettings()

  const handleResetSettings = () => {
    new ConfirmModal(app, {
      title: '重置设置',
      message: '确定要把所有设置恢复为默认值吗？这个操作无法撤销。',
      ctaText: '重置',
      onConfirm: async () => {
        const defaultSettings = smartComposerSettingsSchema.parse({})
        await setSettings(defaultSettings)
        new Notice('设置已恢复为默认值')
      },
    }).open()
  }

  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-header">其他</div>

      <ObsidianSetting
        name="重置设置"
        desc="把所有设置恢复为默认值"
      >
        <ObsidianButton text="重置" warning onClick={handleResetSettings} />
      </ObsidianSetting>
    </div>
  )
}
