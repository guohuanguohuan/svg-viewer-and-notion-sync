import { App, Notice } from 'obsidian'
import { useState } from 'react'

import SmartComposerPlugin from '../../../../main'
import { ChatModel, chatModelSchema } from '../../../../types/chat-model.types'
import { ObsidianButton } from '../../../common/ObsidianButton'
import { ObsidianDropdown } from '../../../common/ObsidianDropdown'
import { ObsidianSetting } from '../../../common/ObsidianSetting'
import { ObsidianTextInput } from '../../../common/ObsidianTextInput'
import { ObsidianToggle } from '../../../common/ObsidianToggle'
import { ReactModal } from '../../../common/ReactModal'

type SettingsComponentProps = {
  model: ChatModel
  plugin: SmartComposerPlugin
  onClose: () => void
}

export class ChatModelSettingsModal extends ReactModal<SettingsComponentProps> {
  constructor(model: ChatModel, app: App, plugin: SmartComposerPlugin) {
    const modelSettings = getModelSettings(model)
    super({
      app,
      Component: modelSettings
        ? modelSettings.SettingsComponent
        : () => <div>这个模型没有额外设置项。</div>,
      props: { model, plugin },
      options: {
        title: `编辑聊天模型：${model.id}`,
      },
    })
  }
}

type ModelSettingsRegistry = {
  check: (model: ChatModel) => boolean
  SettingsComponent: React.FC<SettingsComponentProps>
}

const MODEL_SETTINGS_REGISTRY: ModelSettingsRegistry[] = [
  {
    check: (model) => model.providerType === 'openai',

    SettingsComponent: (props: SettingsComponentProps) => {
      const { model, plugin, onClose } = props
      const typedModel = model as ChatModel & { providerType: 'openai' }
      const [reasoningEnabled, setReasoningEnabled] = useState<boolean>(
        typedModel.reasoning?.enabled ?? false,
      )
      const [reasoningEffort, setReasoningEffort] = useState<string>(
        typedModel.reasoning?.reasoning_effort ?? 'medium',
      )

      const handleSubmit = async () => {
        if (!['low', 'medium', 'high'].includes(reasoningEffort)) {
          new Notice('推理强度只能是 "low"、"medium" 或 "high"。')
          return
        }

        const updatedModel = {
          ...typedModel,
          reasoning: {
            enabled: reasoningEnabled,
            reasoning_effort: reasoningEffort,
          },
        }

        const validationResult = chatModelSchema.safeParse(updatedModel)
        if (!validationResult.success) {
          new Notice(
            validationResult.error.issues.map((v) => v.message).join('\n'),
          )
          return
        }

        await plugin.setSettings({
          ...plugin.settings,
          chatModels: plugin.settings.chatModels.map((m) =>
            m.id === model.id ? updatedModel : m,
          ),
        })
        onClose()
      }

      return (
        <>
          <ObsidianSetting
            name="推理"
            desc='为模型启用推理。适用于 o 系列模型（如 o3、o4-mini）和 GPT-5 系列。'
          >
            <ObsidianToggle
              value={reasoningEnabled}
              onChange={(value: boolean) => setReasoningEnabled(value)}
            />
          </ObsidianSetting>
          {reasoningEnabled && (
            <ObsidianSetting
              name="推理强度"
              desc='控制模型在回答前的思考量，默认是 "medium"。'
              className="smtcmp-setting-item--nested"
              required
            >
              <ObsidianDropdown
                value={reasoningEffort}
                options={{
                  low: 'low',
                  medium: 'medium',
                  high: 'high',
                }}
                onChange={(value: string) => setReasoningEffort(value)}
              />
            </ObsidianSetting>
          )}

          <ObsidianSetting>
            <ObsidianButton text="保存" onClick={handleSubmit} cta />
            <ObsidianButton text="取消" onClick={onClose} />
          </ObsidianSetting>
        </>
      )
    },
  },
  {
    check: (model) => model.providerType === 'openai-plan',

    SettingsComponent: (props: SettingsComponentProps) => {
      const { model, plugin, onClose } = props
      const typedModel = model as ChatModel & { providerType: 'openai-plan' }
      const [reasoningEffort, setReasoningEffort] = useState<string>(
        typedModel.reasoning?.reasoning_effort ?? '',
      )
      const [reasoningSummary, setReasoningSummary] = useState<string>(
        typedModel.reasoning?.reasoning_summary ?? '',
      )

      const handleSubmit = async () => {
        const updatedReasoning = {
          reasoning_effort: reasoningEffort || undefined,
          reasoning_summary: reasoningSummary || undefined,
        }
        const updatedModel = {
          ...typedModel,
          reasoning:
            updatedReasoning.reasoning_effort ||
            updatedReasoning.reasoning_summary
              ? updatedReasoning
              : undefined,
        }

        const validationResult = chatModelSchema.safeParse(updatedModel)
        if (!validationResult.success) {
          new Notice(
            validationResult.error.issues.map((v) => v.message).join('\n'),
          )
          return
        }

        await plugin.setSettings({
          ...plugin.settings,
          chatModels: plugin.settings.chatModels.map((m) =>
            m.id === model.id ? updatedModel : m,
          ),
        })
        onClose()
      }

      return (
        <>
          <ObsidianSetting
            name="推理强度"
            desc="控制模型在回答前的思考量。"
          >
            <ObsidianDropdown
              value={reasoningEffort}
              options={{
                '': '未设置（使用 OpenAI 默认值）',
                none: 'none',
                minimal: 'minimal',
                low: 'low',
                medium: 'medium',
                high: 'high',
                xhigh: 'xhigh',
              }}
              onChange={(value: string) => setReasoningEffort(value)}
            />
          </ObsidianSetting>
          <ObsidianSetting
            name="推理摘要"
            desc="可选的推理摘要输出方式。"
          >
            <ObsidianDropdown
              value={reasoningSummary}
              options={{
                '': '未设置（使用 OpenAI 默认值）',
                auto: 'auto',
                concise: 'concise',
                detailed: 'detailed',
              }}
              onChange={(value: string) => setReasoningSummary(value)}
            />
          </ObsidianSetting>

          <ObsidianSetting>
            <ObsidianButton text="保存" onClick={handleSubmit} cta />
            <ObsidianButton text="取消" onClick={onClose} />
          </ObsidianSetting>
        </>
      )
    },
  },
  {
    check: (model) =>
      model.providerType === 'anthropic' ||
      model.providerType === 'anthropic-plan',
    SettingsComponent: (props: SettingsComponentProps) => {
      const DEFAULT_THINKING_BUDGET_TOKENS = 8192

      const { model, plugin, onClose } = props
      const typedModel = model as ChatModel & { providerType: 'anthropic' }
      const [thinkingEnabled, setThinkingEnabled] = useState<boolean>(
        typedModel.thinking?.enabled ?? false,
      )
      const [budgetTokens, setBudgetTokens] = useState(
        (
          typedModel.thinking?.budget_tokens ?? DEFAULT_THINKING_BUDGET_TOKENS
        ).toString(),
      )

      const handleSubmit = async () => {
        const parsedTokens = parseInt(budgetTokens, 10)
        if (isNaN(parsedTokens)) {
          new Notice('请输入有效数字')
          return
        }

        if (parsedTokens < 1024) {
          new Notice('预算 tokens 不能小于 1024')
          return
        }

        const updatedModel = {
          ...typedModel,
          thinking: {
            enabled: thinkingEnabled,
            budget_tokens: parsedTokens,
          },
        }

        const validationResult = chatModelSchema.safeParse(updatedModel)
        if (!validationResult.success) {
          new Notice(
            validationResult.error.issues.map((v) => v.message).join('\n'),
          )
          return
        }

        await plugin.setSettings({
          ...plugin.settings,
          chatModels: plugin.settings.chatModels.map((m) =>
            m.id === model.id ? updatedModel : m,
          ),
        })
        onClose()
      }

      return (
        <>
          <ObsidianSetting
            name="扩展思考"
            desc="为 Claude 启用扩展思考。适用于 Claude Sonnet 3.7+ 和 Claude Opus 4.0+。"
          >
            <ObsidianToggle
              value={thinkingEnabled}
              onChange={(value: boolean) => setThinkingEnabled(value)}
            />
          </ObsidianSetting>
          {thinkingEnabled && (
            <ObsidianSetting
              name="预算 tokens"
              desc="Claude 可用于思考的最大 token 数，最少为 1024。"
              className="smtcmp-setting-item--nested"
              required
            >
              <ObsidianTextInput
                value={budgetTokens}
                placeholder="输入 token 数量"
                onChange={(value: string) => setBudgetTokens(value)}
                type="number"
              />
            </ObsidianSetting>
          )}

          <ObsidianSetting>
            <ObsidianButton text="保存" onClick={handleSubmit} cta />
            <ObsidianButton text="取消" onClick={onClose} />
          </ObsidianSetting>
        </>
      )
    },
  },
  {
    check: (model) =>
      model.providerType === 'gemini' || model.providerType === 'gemini-plan',
    SettingsComponent: (props: SettingsComponentProps) => {
      const { model, plugin, onClose } = props
      const typedModel = model as ChatModel & {
        providerType: 'gemini' | 'gemini-plan'
      }
      const [thinkingEnabled, setThinkingEnabled] = useState<boolean>(
        typedModel.thinking?.enabled ?? false,
      )
      const [controlMode, setControlMode] = useState<'level' | 'budget'>(
        typedModel.thinking?.control_mode ?? 'level',
      )
      const [thinkingLevel, setThinkingLevel] = useState<string>(
        String(typedModel.thinking?.thinking_level ?? 'high'),
      )
      const [thinkingBudget, setThinkingBudget] = useState<string>(
        String(typedModel.thinking?.thinking_budget ?? -1),
      )
      const [includeThoughts, setIncludeThoughts] = useState<boolean>(
        Boolean(typedModel.thinking?.include_thoughts ?? false),
      )

      const handleSubmit = async () => {
        let parsedBudget: number | undefined
        if (controlMode === 'budget') {
          parsedBudget = parseInt(thinkingBudget, 10)
          if (isNaN(parsedBudget)) {
            new Notice('请输入有效的 thinking budget 数值')
            return
          }
        }

        const updatedModel = {
          ...typedModel,
          thinking: {
            enabled: thinkingEnabled,
            control_mode: controlMode,
            thinking_level:
              controlMode === 'level'
                ? (thinkingLevel as 'minimal' | 'low' | 'medium' | 'high')
                : undefined,
            thinking_budget:
              controlMode === 'budget' ? parsedBudget : undefined,
            include_thoughts: includeThoughts,
          },
        }

        const validationResult = chatModelSchema.safeParse(updatedModel)
        if (!validationResult.success) {
          new Notice(
            validationResult.error.issues.map((v) => v.message).join('\n'),
          )
          return
        }

        await plugin.setSettings({
          ...plugin.settings,
          chatModels: plugin.settings.chatModels.map((m) =>
            m.id === model.id ? updatedModel : m,
          ),
        })
        onClose()
      }

      return (
        <>
          <ObsidianSetting
            name="思考设置"
            desc="自定义思考级别或预算。关闭后，模型将使用默认行为（大多数 Gemini 2.5 / 3 模型会采用动态思考）。"
          >
            <ObsidianToggle
              value={thinkingEnabled}
              onChange={(value: boolean) => setThinkingEnabled(value)}
            />
          </ObsidianSetting>
          {thinkingEnabled && (
            <>
              <ObsidianSetting
                name="控制模式"
                desc='Gemini 3 模型一般使用 "Level"，Gemini 2.5 模型一般使用 "Budget"。'
                className="smtcmp-setting-item--nested"
              >
                <ObsidianDropdown
                  value={controlMode}
                  options={{
                    level: 'Level（Gemini 3）',
                    budget: 'Budget（Gemini 2.5）',
                  }}
                  onChange={(value: string) =>
                    setControlMode(value as 'level' | 'budget')
                  }
                />
              </ObsidianSetting>
              {controlMode === 'level' && (
                <ObsidianSetting
                  name="思考级别"
                  desc='控制推理深度，Gemini 3 默认通常是 "high"。'
                  className="smtcmp-setting-item--nested"
                >
                  <ObsidianDropdown
                    value={thinkingLevel}
                    options={{
                      minimal: 'minimal',
                      low: 'low',
                      medium: 'medium',
                      high: 'high',
                    }}
                    onChange={(value: string) => setThinkingLevel(value)}
                  />
                </ObsidianSetting>
              )}
              {controlMode === 'budget' && (
                <ObsidianSetting
                  name="思考预算"
                  desc="用于思考的 token 预算。-1 表示动态，0 表示关闭。"
                  className="smtcmp-setting-item--nested"
                >
                  <ObsidianTextInput
                    value={thinkingBudget}
                    placeholder="-1 表示动态"
                    onChange={(value: string) => setThinkingBudget(value)}
                    type="number"
                  />
                </ObsidianSetting>
              )}
              <ObsidianSetting
                name="包含思考摘要"
                desc="显示模型推理过程的摘要。启用后可能会增加 token 消耗。"
                className="smtcmp-setting-item--nested"
              >
                <ObsidianToggle
                  value={includeThoughts}
                  onChange={(value: boolean) => setIncludeThoughts(value)}
                />
              </ObsidianSetting>
            </>
          )}

          <ObsidianSetting>
            <ObsidianButton text="保存" onClick={handleSubmit} cta />
            <ObsidianButton text="取消" onClick={onClose} />
          </ObsidianSetting>
        </>
      )
    },
  },
  {
    check: (model) =>
      model.providerType === 'perplexity' &&
      [
        'sonar',
        'sonar-pro',
        'sonar-deep-research',
        'sonar-reasoning',
        'sonar-reasoning-pro',
      ].includes(model.model),

    SettingsComponent: (props: SettingsComponentProps) => {
      const { model, plugin, onClose } = props
      const typedModel = model as ChatModel & { providerType: 'perplexity' }
      const [searchContextSize, setSearchContextSize] = useState(
        typedModel.web_search_options?.search_context_size ?? 'low',
      )

      const handleSubmit = async () => {
        if (!['low', 'medium', 'high'].includes(searchContextSize)) {
          new Notice('搜索上下文大小只能是 "low"、"medium" 或 "high"。')
          return
        }

        const updatedModel = {
          ...typedModel,
          web_search_options: {
            ...typedModel.web_search_options,
            search_context_size: searchContextSize,
          },
        }
        await plugin.setSettings({
          ...plugin.settings,
          chatModels: plugin.settings.chatModels.map((m) =>
            m.id === model.id ? updatedModel : m,
          ),
        })
        onClose()
      }

      return (
        <>
          <ObsidianSetting
            name="搜索上下文大小"
            desc='控制为模型检索多少搜索上下文。"low" 成本更低，"medium" 更均衡，"high" 上下文最多但成本更高。默认是 "low"。'
          >
            <ObsidianDropdown
              value={searchContextSize}
              options={{
                low: 'low',
                medium: 'medium',
                high: 'high',
              }}
              onChange={(value: string) => setSearchContextSize(value)}
            />
          </ObsidianSetting>

          <ObsidianSetting>
            <ObsidianButton text="保存" onClick={handleSubmit} cta />
            <ObsidianButton text="取消" onClick={onClose} />
          </ObsidianSetting>
        </>
      )
    },
  },
]

function getModelSettings(model: ChatModel): ModelSettingsRegistry | undefined {
  return MODEL_SETTINGS_REGISTRY.find((registry) => registry.check(model))
}

export function hasChatModelSettings(model: ChatModel): boolean {
  return !!getModelSettings(model)
}
