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
import { parseJsonWithComments } from '../../../utils/json-with-comments'
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
      app,
      Component: McpServerFormComponent,
      props: { plugin },
      options: {
        title: '添加 MCP 服务',
      },
    })
  }
}

export class EditMcpServerModal extends ReactModal<McpServerFormComponentProps> {
  constructor(app: App, plugin: SmartComposerPlugin, editServerId: string) {
    super({
      app,
      Component: McpServerFormComponent,
      props: { plugin, serverId: editServerId },
      options: {
        title: '编辑 MCP 服务',
      },
    })
  }
}

function buildParametersDraft(parameters?: McpServerParameters): string {
  if (parameters) {
    return JSON.stringify(parameters, null, 2)
  }

  return `{
  // command: 用于启动 MCP 服务的命令
  "command": "npx",
  // args: 启动参数，可选
  "args": [
    "-y",
    "@modelcontextprotocol/server-github"
  ],
  // env: 环境变量，可选
  "env": {
    // GitHub 个人访问令牌
    "GITHUB_PERSONAL_ACCESS_TOKEN": "<在这里填写你的令牌>"
  }
}`
}

function formatZodError(error: z.ZodError): string {
  return error.errors
    .map((err) => {
      const path = err.path.length > 0 ? `${err.path.join('.')}: ` : ''
      return `${path}${err.message}`
    })
    .join('\n')
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
    buildParametersDraft(existingServer?.parameters),
  )
  const [validationError, setValidationError] = useState<string | null>(null)

  const PARAMETERS_PLACEHOLDER = buildParametersDraft()

  const handleSubmit = async () => {
    try {
      const serverName = name.trim()
      if (serverName.length === 0) {
        throw new Error('名称不能为空')
      }

      try {
        validateServerName(serverName)
      } catch {
        throw new Error(
          'MCP 服务名称只能包含字母、数字、下划线和短横线，且不能包含分隔符。',
        )
      }

      if (
        plugin.settings.mcp.servers.find(
          (server) =>
            server.id === serverName && server.id !== existingServer?.id,
        )
      ) {
        throw new Error('已经存在同名的 MCP 服务')
      }

      if (parameters.trim().length === 0) {
        throw new Error('参数不能为空')
      }

      let parsedParameters: unknown
      try {
        parsedParameters = parseJsonWithComments(parameters)
      } catch {
        throw new Error('参数必须是合法的 JSON，可包含 // 中文注释')
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
      if (error instanceof z.ZodError) {
        new Notice(formatZodError(error))
      } else if (error instanceof Error) {
        new Notice(error.message)
      } else {
        new Notice('保存 MCP 服务失败。')
      }
    }
  }

  const validateParameters = useCallback((nextParameters: string) => {
    try {
      if (nextParameters.length === 0) {
        setValidationError('参数不能为空')
        return
      }

      const parsedParameters = parseJsonWithComments(nextParameters)
      mcpServerParametersSchema.strict().parse(parsedParameters)
      setValidationError(null)
    } catch (error) {
      if (error instanceof SyntaxError) {
        setValidationError('JSON 格式无效')
      } else if (error instanceof z.ZodError) {
        setValidationError(formatZodError(error))
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
      <ObsidianSetting
        name="名称"
        desc="MCP 服务名称。只能包含字母、数字、下划线和短横线。"
        required
      >
        <ObsidianTextInput
          value={name}
          onChange={(value: string) => setName(value)}
          placeholder="例如：github"
        />
      </ObsidianSetting>

      <ObsidianSetting
        name="参数"
        desc={`用于定义如何启动 MCP 服务的 JSON 配置，支持写 // 中文注释：
- "command"：可执行命令，例如 "npx"、"node"
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
