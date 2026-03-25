import { $generateNodesFromSerializedNodes } from '@lexical/clipboard'
import { BaseSerializedNode } from '@lexical/clipboard/clipboard'
import { InitialEditorStateType } from '@lexical/react/LexicalComposer'
import { $insertNodes, LexicalEditor } from 'lexical'
import { App, Notice } from 'obsidian'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AppProvider } from '../../contexts/app-context'
import { DuplicateTemplateException } from '../../database/json/exception'
import { TemplateManager } from '../../database/json/template/TemplateManager'
import LexicalContentEditable from '../chat-view/chat-input/LexicalContentEditable'
import { ObsidianButton } from '../common/ObsidianButton'
import { ObsidianSetting } from '../common/ObsidianSetting'
import { ObsidianTextInput } from '../common/ObsidianTextInput'
import { ReactModal } from '../common/ReactModal'

type TemplateFormComponentProps = {
  app: App
  selectedSerializedNodes?: BaseSerializedNode[] | null
  templateId?: string
  onSubmit?: () => void
  onClose: () => void
}

export class CreateTemplateModal extends ReactModal<TemplateFormComponentProps> {
  constructor({
    app,
    selectedSerializedNodes,
    onSubmit,
  }: {
    app: App
    selectedSerializedNodes?: BaseSerializedNode[] | null
    onSubmit?: () => void
  }) {
    super({
      app: app,
      Component: TemplateFormComponentWrapper,
      props: {
        app,
        selectedSerializedNodes,
        onSubmit,
      },
      options: {
        title: '新增模板',
      },
    })
  }
}

export class EditTemplateModal extends ReactModal<TemplateFormComponentProps> {
  constructor({
    app,
    templateId,
    onSubmit,
  }: {
    app: App
    templateId?: string
    onSubmit?: () => void
  }) {
    super({
      app: app,
      Component: TemplateFormComponentWrapper,
      props: {
        app,
        templateId,
        onSubmit,
      },
      options: {
        title: '编辑模板',
      },
    })
  }
}

function TemplateFormComponentWrapper({
  app,
  selectedSerializedNodes,
  templateId,
  onSubmit,
  onClose,
}: TemplateFormComponentProps) {
  return (
    <AppProvider app={app}>
      <TemplateFormComponent
        app={app}
        selectedSerializedNodes={selectedSerializedNodes}
        templateId={templateId}
        onSubmit={onSubmit}
        onClose={onClose}
      />
    </AppProvider>
  )
}

function TemplateFormComponent({
  app,
  selectedSerializedNodes,
  templateId,
  onSubmit,
  onClose,
}: TemplateFormComponentProps) {
  const templateManager = useMemo(() => new TemplateManager(app), [app])

  const [templateName, setTemplateName] = useState('')
  const editorRef = useRef<LexicalEditor | null>(null)
  const contentEditableRef = useRef<HTMLDivElement>(null)

  const initialEditorState: InitialEditorStateType = (
    editor: LexicalEditor,
  ) => {
    if (!selectedSerializedNodes) return
    editor.update(() => {
      const parsedNodes = $generateNodesFromSerializedNodes(
        selectedSerializedNodes,
      )
      $insertNodes(parsedNodes)
    })
  }

  const handleSubmit = async () => {
    try {
      if (!editorRef.current) return
      const serializedEditorState = editorRef.current.toJSON()
      const nodes = serializedEditorState.editorState.root.children
      if (nodes.length === 0) {
        new Notice('请输入模板内容')
        return
      }
      if (templateName.trim().length === 0) {
        new Notice('请输入模板名称')
        return
      }

      if (templateId === undefined) {
        await templateManager.createTemplate({
          name: templateName,
          content: { nodes },
        })
      } else {
        await templateManager.updateTemplate(templateId, {
          name: templateName,
          content: { nodes },
        })
      }

      new Notice(
        `模板已${templateId === undefined ? '创建' : '更新'}：${templateName}`,
      )

      onSubmit?.()
      onClose()
    } catch (error) {
      if (error instanceof DuplicateTemplateException) {
        new Notice('已存在同名模板')
      } else {
        console.error(error)
        new Notice('保存模板失败')
      }
    }
  }

  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true

    async function fetchExistingTemplate(templateId: string) {
      try {
        const existingTemplate = await templateManager.findById(templateId)
        if (existingTemplate && isMountedRef.current) {
          setTemplateName(existingTemplate.name)
          editorRef.current?.update(() => {
            const parsedNodes = $generateNodesFromSerializedNodes(
              existingTemplate.content.nodes,
            )
            $insertNodes(parsedNodes)
          })
        }
      } catch (error) {
        console.error('Failed to fetch existing template:', error)
        new Notice('加载模板失败，请重试。')
      }
    }
    if (templateId) {
      fetchExistingTemplate(templateId)
    }

    return () => {
      isMountedRef.current = false
    }
  }, [templateId, templateManager])

  return (
    <>
      <ObsidianSetting name="名称" desc="模板名称" required>
        <ObsidianTextInput
          value={templateName}
          onChange={(value) => setTemplateName(value)}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name="模板内容"
        desc="模板的正文内容"
        className="smtcmp-settings-description-preserve-whitespace"
        required
      />
      <div className="smtcmp-chat-user-input-container">
        <LexicalContentEditable
          initialEditorState={initialEditorState}
          editorRef={editorRef}
          contentEditableRef={contentEditableRef}
          onEnter={handleSubmit}
        />
      </div>

      <ObsidianSetting>
        <ObsidianButton text="保存" onClick={handleSubmit} cta />
        <ObsidianButton text="取消" onClick={onClose} />
      </ObsidianSetting>
    </>
  )
}
