import { agentSkillRegistry, type AgentSkillId } from './skillsRegistry'
import {
  createIdleExecutionSteps,
  type AgentExecutionStage,
  type AgentExecutionStep,
} from './stateMachine'

export type AgentRunInput = {
  instruction: string
  currentFilePath?: string | null
  selectedText?: string
}

export type AgentRunSnapshot = {
  skill: AgentSkillId
  currentStage: AgentExecutionStage
  steps: AgentExecutionStep[]
  input: AgentRunInput
}

export const createInitialAgentRunSnapshot = (
  skill: AgentSkillId,
  input: AgentRunInput,
): AgentRunSnapshot => {
  const allowedStages =
    agentSkillRegistry.find((definition) => definition.id === skill)?.stages ?? []
  const steps = createIdleExecutionSteps().map((step) => ({
    ...step,
    status: allowedStages.includes(step.stage)
      ? step.status
      : ('completed' as const),
  }))

  return {
    skill,
    currentStage: 'idle',
    steps,
    input,
  }
}
