import { App, Notice } from 'obsidian'
import { useCallback, useEffect, useState } from 'react'
import TextareaAutosize from 'react-textarea-autosize'
import * as z from 'zod'

import { validateServerName } from '../../../core/mcp/tool-name-utils'
import SmartComposerPlugin from '../../../main'
import {
  McpServerParameters,
  mcpServerParametersSchema,
} from '../../../types/mcp.types'
import { ObsidianButton } from '../../common/ObsidianButton'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianTextInput } from '../../common/ObsidianTextInput'
import { ReactModal } from '../../common/ReactModal'

type McpServerFormComponentProps = {
  plugin: SmartComposerPlugin
  onClose: () => void
  serverId?: string
}

export class AddMcpServerModal extends ReactModal<McpServerFormComponentProps> {
  constructor(app: App, plugin: SmartComposerPlugin) {
    super({
      app: app,
      Component: McpServerFormComponent,
      props: { plugin },
      options: {
        title: '添加 MCP 服务器',
      },
    })
  }
}

export class EditMcpServerModal extends ReactModal<McpServerFormComponentProps> {
  constructor(app: App, plugin: SmartComposerPlugin, editServerId: string) {
    super({
      app: app,
      Component: McpServerFormComponent,
      props: { plugin, serverId: editServerId },
      options: {
        title: '编辑 MCP 服务器',
      },
    })
  }
}

function McpServerFormComponent({
  plugin,
  onClose,
  serverId,
}: McpServerFormComponentProps) {
  const existingServer = serverId
    ? plugin.settings.mcp.servers.find((server) => server.id === serverId)
    : undefined

  const [name, setName] = useState(existingServer?.id ?? '')
  const [parameters, setParameters] = useState(
    existingServer ? JSON.stringify(existingServer.parameters, null, 2) : '',
  )
  const [validationError, setValidationError] = useState<string | null>(null)

  const PARAMETERS_PLACEHOLDER = JSON.stringify(
    {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: '<YOUR_TOKEN>',
      },
    },
    null,
    2,
  )

  const handleSubmit = async () => {
    try {
      const serverName = name.trim()
      if (serverName.length === 0) {
        throw new Error('名称不能为空')
      }
      validateServerName(serverName)

      if (
        plugin.settings.mcp.servers.find(
          (server) =>
            server.id === serverName && server.id !== existingServer?.id,
        )
      ) {
        throw new Error('已存在同名服务器')
      }

      if (parameters.trim().length === 0) {
        throw new Error('参数不能为空')
      }
      let parsedParameters: unknown
      try {
        parsedParameters = JSON.parse(parameters)
      } catch {
        throw new Error('参数必须是合法 JSON')
      }
      const validatedParameters: McpServerParameters = mcpServerParametersSchema
        .strict()
        .parse(parsedParameters)

      const newSettings = {
        ...plugin.settings,
        mcp: {
          ...plugin.settings.mcp,
          servers: existingServer
            ? plugin.settings.mcp.servers.map((server) =>
                server.id === existingServer.id
                  ? {
                      ...server,
                      id: serverName,
                      parameters: validatedParameters,
                    }
                  : server,
              )
            : [
                ...plugin.settings.mcp.servers,
                {
                  id: serverName,
                  parameters: validatedParameters,
                  toolOptions: {},
                  enabled: true,
                },
              ],
        },
      }

      await plugin.setSettings(newSettings)

      onClose()
    } catch (error) {
      if (error instanceof Error) {
        new Notice(error.message)
      } else {
        console.error(error)
        new Notice('保存 MCP 服务器失败。')
      }
    }
  }

  const validateParameters = useCallback((parameters: string) => {
    try {
      if (parameters.length === 0) {
        setValidationError('参数不能为空')
        return
      }
      const parsedParameters = JSON.parse(parameters)
      mcpServerParametersSchema.strict().parse(parsedParameters)
      setValidationError(null)
    } catch (error) {
      if (error instanceof SyntaxError) {
        setValidationError('JSON 格式无效')
      } else if (error instanceof z.ZodError) {
        const formattedErrors = error.errors
          .map((err) => {
            const path = err.path.length > 0 ? `${err.path.join('.')}: ` : ''
            return `${path}${err.message}`
          })
          .join('\n')
        setValidationError(formattedErrors)
      } else {
        setValidationError(
          error instanceof Error ? error.message : '参数无效',
        )
      }
    }
  }, [])

  useEffect(() => {
    validateParameters(parameters)
  }, [parameters, validateParameters])

  return (
    <>
      <ObsidianSetting name="名称" desc="MCP 服务器名称" required>
        <ObsidianTextInput
          value={name}
          onChange={(value: string) => setName(value)}
          placeholder="例如：github"
        />
      </ObsidianSetting>

      <ObsidianSetting
        name="参数"
        desc={`用于定义如何启动 MCP 服务器的 JSON 配置，格式包括：
- "command"：可执行命令名，例如 "npx"、"node"
- "args"：可选，命令行参数数组
- "env"：可选，环境变量键值对`}
        className="smtcmp-settings-textarea-header smtcmp-settings-description-preserve-whitespace"
        required
      />
      <TextareaAutosize
        value={parameters}
        placeholder={PARAMETERS_PLACEHOLDER}
        onChange={(e) => setParameters(e.target.value)}
        className="smtcmp-mcp-server-modal-textarea"
        maxRows={20}
        minRows={PARAMETERS_PLACEHOLDER.split('\n').length}
      />
      {validationError !== null ? (
        <div className="smtcmp-mcp-server-modal-validation smtcmp-mcp-server-modal-validation--error">
          {validationError}
        </div>
      ) : (
        <div className="smtcmp-mcp-server-modal-validation smtcmp-mcp-server-modal-validation--success">
          参数有效
        </div>
      )}

      <ObsidianSetting>
        <ObsidianButton text="保存" onClick={handleSubmit} cta />
        <ObsidianButton text="取消" onClick={onClose} />
      </ObsidianSetting>
    </>
  )
}
