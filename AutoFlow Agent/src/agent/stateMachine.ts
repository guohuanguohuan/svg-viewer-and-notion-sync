export const agentExecutionStages = [
  'idle',
  'route-skill',
  'collect-context',
  'run-tools',
  'generate-candidate',
  'review-candidate',
  'preview-diff',
  'await-approval',
  'write-output',
  'completed',
  'failed',
] as const

export type AgentExecutionStage = (typeof agentExecutionStages)[number]

export type AgentExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'

export type AgentExecutionStep = {
  stage: AgentExecutionStage
  status: AgentExecutionStatus
  summary: string
  detail?: string
  startedAt?: number
  finishedAt?: number
}

export const createIdleExecutionSteps = (): AgentExecutionStep[] => {
  return agentExecutionStages.map((stage) => ({
    stage,
    status: stage === 'idle' ? 'running' : 'pending',
    summary: stage,
  }))
}
