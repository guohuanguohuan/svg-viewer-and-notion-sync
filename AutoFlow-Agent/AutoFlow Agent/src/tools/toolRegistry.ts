export const agentToolNames = [
  'readCurrentNote',
  'readSelection',
  'readHeadingBlock',
  'searchVault',
  'webSearch',
  'generateCandidate',
  'reviewCandidate',
  'showDiff',
  'backupNote',
  'writeBack',
  'rollbackLastWrite',
] as const

export type AgentToolName = (typeof agentToolNames)[number]

export type AgentToolDefinition = {
  name: AgentToolName
  description: string
  risk: 'read' | 'network' | 'generation' | 'preview' | 'write'
  requiresApproval: boolean
}

export const agentToolRegistry: AgentToolDefinition[] = [
  {
    name: 'readCurrentNote',
    description: 'Read the active markdown note.',
    risk: 'read',
    requiresApproval: false,
  },
  {
    name: 'readSelection',
    description: 'Read the active editor selection.',
    risk: 'read',
    requiresApproval: false,
  },
  {
    name: 'readHeadingBlock',
    description: 'Read the current heading block when no selection is present.',
    risk: 'read',
    requiresApproval: false,
  },
  {
    name: 'searchVault',
    description: 'Search local vault files for related material.',
    risk: 'read',
    requiresApproval: false,
  },
  {
    name: 'webSearch',
    description: 'Run a network search for fact checking.',
    risk: 'network',
    requiresApproval: false,
  },
  {
    name: 'generateCandidate',
    description: 'Generate the first candidate draft.',
    risk: 'generation',
    requiresApproval: false,
  },
  {
    name: 'reviewCandidate',
    description: 'Score a candidate draft and return revision targets.',
    risk: 'generation',
    requiresApproval: false,
  },
  {
    name: 'showDiff',
    description: 'Preview paragraph-level changes before writing.',
    risk: 'preview',
    requiresApproval: false,
  },
  {
    name: 'backupNote',
    description: 'Create a recoverable backup before writing.',
    risk: 'write',
    requiresApproval: false,
  },
  {
    name: 'writeBack',
    description: 'Write the approved candidate into the target file.',
    risk: 'write',
    requiresApproval: true,
  },
  {
    name: 'rollbackLastWrite',
    description: 'Restore the most recent checkpoint.',
    risk: 'write',
    requiresApproval: true,
  },
]
