import { Edit, Trash2 } from 'lucide-react'
import { App, Notice } from 'obsidian'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useSettings } from '../../../contexts/settings-context'
import { TemplateManager } from '../../../database/json/template/TemplateManager'
import { TemplateMetadata } from '../../../database/json/template/types'
import { ObsidianButton } from '../../common/ObsidianButton'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianTextArea } from '../../common/ObsidianTextArea'
import { ConfirmModal } from '../../modals/ConfirmModal'
import {
  CreateTemplateModal,
  EditTemplateModal,
} from '../../modals/TemplateFormModal'

type TemplateSectionProps = {
  app: App
}

export function TemplateSection({ app }: TemplateSectionProps) {
  const { settings, setSettings } = useSettings()
  const templateManager = useMemo(() => new TemplateManager(app), [app])

  const [templateList, setTemplateList] = useState<TemplateMetadata[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchTemplateList = useCallback(async () => {
    setIsLoading(true)
    try {
      setTemplateList(await templateManager.listMetadata())
    } catch (error) {
      console.error('Failed to fetch template list:', error)
      new Notice('加载模板失败，请尝试刷新设置页。')
      setTemplateList([])
    } finally {
      setIsLoading(false)
    }
  }, [templateManager])

  const handleCreate = useCallback(() => {
    new CreateTemplateModal({
      app,
      selectedSerializedNodes: null,
      onSubmit: fetchTemplateList,
    }).open()
  }, [fetchTemplateList, app])

  const handleEdit = useCallback(
    (template: TemplateMetadata) => {
      new EditTemplateModal({
        app,
        templateId: template.id,
        onSubmit: fetchTemplateList,
      }).open()
    },
    [fetchTemplateList, app],
  )

  const handleDelete = useCallback(
    (template: TemplateMetadata) => {
      const message = `确定要删除模板“${template.name}”吗？`
      new ConfirmModal(app, {
        title: '删除模板',
        message,
        ctaText: '删除',
        onConfirm: async () => {
          try {
            await templateManager.deleteTemplate(template.id)
            fetchTemplateList()
          } catch (error) {
            console.error('Failed to delete template:', error)
            new Notice('删除模板失败，请重试。')
          }
        },
      }).open()
    },
    [templateManager, fetchTemplateList, app],
  )

  useEffect(() => {
    fetchTemplateList()
  }, [fetchTemplateList])

  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-header">提示词</div>

      <ObsidianSetting
        name="系统提示词"
        desc="这段提示词会自动追加到每次对话的开头。"
        className="smtcmp-settings-textarea-header"
      />

      <ObsidianSetting className="smtcmp-settings-textarea">
        <ObsidianTextArea
          value={settings.systemPrompt}
          onChange={async (value: string) => {
            await setSettings({
              ...settings,
              systemPrompt: value,
            })
          }}
        />
      </ObsidianSetting>

      <div className="smtcmp-settings-desc smtcmp-settings-callout">
        <strong>模板说明：</strong> 你可以创建可复用的提示词模板，并在聊天中快速插入。在聊天输入框中输入
        <code>/模板名</code>
        即可触发插入；也可以在聊天输入框里选中文本，快速创建模板。
      </div>

      <div className="smtcmp-settings-sub-header-container">
        <div className="smtcmp-settings-sub-header">提示词模板</div>
        <ObsidianButton text="新增提示词模板" onClick={handleCreate} />
      </div>

      <div className="smtcmp-templates-container">
        <div className="smtcmp-templates-header">
          <div>名称</div>
          <div>操作</div>
        </div>
        {isLoading ? (
          <div className="smtcmp-templates-empty">正在加载模板...</div>
        ) : templateList.length > 0 ? (
          templateList.map((template) => (
            <TemplateItem
              key={template.id}
              template={template}
              onDelete={() => {
                handleDelete(template)
              }}
              onEdit={() => {
                handleEdit(template)
              }}
            />
          ))
        ) : (
          <div className="smtcmp-templates-empty">暂无模板</div>
        )}
      </div>
    </div>
  )
}

function TemplateItem({
  template,
  onEdit,
  onDelete,
}: {
  template: TemplateMetadata
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="smtcmp-template">
      <div className="smtcmp-template-row">
        <div className="smtcmp-template-name">{template.name}</div>
        <div className="smtcmp-template-actions">
          <button className="clickable-icon" aria-label="编辑模板" onClick={onEdit}>
            <Edit size={16} />
          </button>
          <button
            className="clickable-icon"
            aria-label="删除模板"
            onClick={onDelete}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
