import type { AgentExecutionStage } from './stateMachine'

export const agentSkillIds = [
  'continue-writing',
  'polish-style',
  'expand-content',
  'make-outline',
  'plan-task',
  'lesson-plan',
  'fact-check',
  'cross-note-synthesis',
  'rewrite-structure',
] as const

export type AgentSkillId = (typeof agentSkillIds)[number]

export type AgentSkillDefinition = {
  id: AgentSkillId
  label: string
  defaultContext: 'selection' | 'current-file' | 'vault'
  requiresApproval: boolean
  stages: AgentExecutionStage[]
}

export const agentSkillRegistry: AgentSkillDefinition[] = [
  {
    id: 'continue-writing',
    label: 'Continue writing',
    defaultContext: 'selection',
    requiresApproval: true,
    stages: [
      'route-skill',
      'collect-context',
      'generate-candidate',
      'review-candidate',
      'preview-diff',
      'await-approval',
      'write-output',
      'completed',
    ],
  },
  {
    id: 'polish-style',
    label: 'Polish style',
    defaultContext: 'selection',
    requiresApproval: true,
    stages: [
      'route-skill',
      'collect-context',
      'generate-candidate',
      'review-candidate',
      'preview-diff',
      'await-approval',
      'write-output',
      'completed',
    ],
  },
  {
    id: 'expand-content',
    label: 'Expand content',
    defaultContext: 'selection',
    requiresApproval: true,
    stages: [
      'route-skill',
      'collect-context',
      'generate-candidate',
      'review-candidate',
      'preview-diff',
      'await-approval',
      'write-output',
      'completed',
    ],
  },
  {
    id: 'make-outline',
    label: 'Make outline',
    defaultContext: 'current-file',
    requiresApproval: false,
    stages: [
      'route-skill',
      'collect-context',
      'generate-candidate',
      'review-candidate',
      'preview-diff',
      'completed',
    ],
  },
  {
    id: 'plan-task',
    label: 'Plan task',
    defaultContext: 'current-file',
    requiresApproval: true,
    stages: ['route-skill', 'collect-context', 'generate-candidate', 'completed'],
  },
  {
    id: 'lesson-plan',
    label: 'Lesson plan',
    defaultContext: 'current-file',
    requiresApproval: true,
    stages: [
      'route-skill',
      'collect-context',
      'generate-candidate',
      'review-candidate',
      'preview-diff',
      'await-approval',
      'write-output',
      'completed',
    ],
  },
  {
    id: 'fact-check',
    label: 'Fact check',
    defaultContext: 'selection',
    requiresApproval: false,
    stages: [
      'route-skill',
      'collect-context',
      'run-tools',
      'generate-candidate',
      'preview-diff',
      'completed',
    ],
  },
  {
    id: 'cross-note-synthesis',
    label: 'Cross-note synthesis',
    defaultContext: 'vault',
    requiresApproval: true,
    stages: [
      'route-skill',
      'collect-context',
      'run-tools',
      'generate-candidate',
      'review-candidate',
      'preview-diff',
      'await-approval',
      'write-output',
      'completed',
    ],
  },
  {
    id: 'rewrite-structure',
    label: 'Rewrite structure',
    defaultContext: 'current-file',
    requiresApproval: true,
    stages: [
      'route-skill',
      'collect-context',
      'generate-candidate',
      'preview-diff',
      'await-approval',
      'write-output',
      'completed',
    ],
  },
]
