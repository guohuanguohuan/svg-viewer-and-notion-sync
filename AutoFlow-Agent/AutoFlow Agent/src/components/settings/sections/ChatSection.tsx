import { useSettings } from '../../../contexts/settings-context'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianTextInput } from '../../common/ObsidianTextInput'
import { ObsidianToggle } from '../../common/ObsidianToggle'

export function ChatSection() {
  const { settings, setSettings } = useSettings()

  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-header">聊天</div>

      <div className="smtcmp-settings-desc">
        聊天模型和执行模型的手动配置，已经统一移动到下方的 JSON
        配置区。
      </div>

      <ObsidianSetting
        name="包含当前文件"
        desc="聊天时自动把当前文件内容作为上下文，一起发送给模型。"
      >
        <ObsidianToggle
          value={settings.chatOptions.includeCurrentFileContent}
          onChange={async (value) => {
            await setSettings({
              ...settings,
              chatOptions: {
                ...settings.chatOptions,
                includeCurrentFileContent: value,
              },
            })
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name="启用工具"
        desc="允许 AI 调用 MCP 工具。关闭后将只进行纯对话。"
      >
        <ObsidianToggle
          value={settings.chatOptions.enableTools}
          onChange={async (value) => {
            await setSettings({
              ...settings,
              chatOptions: {
                ...settings.chatOptions,
                enableTools: value,
              },
            })
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name="最大自动执行轮数"
        desc="控制 AI 在一次对话中，最多连续自动执行多少轮“思考 -> 调工具 -> 读取结果 -> 继续”。数值越高，越像自动代理，但 token 消耗和误调用风险也会增加。"
      >
        <ObsidianTextInput
          value={settings.chatOptions.maxAutoIterations.toString()}
          onChange={async (value) => {
            const parsedValue = parseInt(value, 10)
            if (isNaN(parsedValue) || parsedValue < 1) {
              return
            }

            await setSettings({
              ...settings,
              chatOptions: {
                ...settings.chatOptions,
                maxAutoIterations: parsedValue,
              },
            })
          }}
        />
      </ObsidianSetting>
    </div>
  )
}
