export type WritePipelineStage =
  | 'diff'
  | 'approval'
  | 'backup'
  | 'write'
  | 'rollback'

export type WriteCandidate = {
  originalContent: string
  candidateContent: string
}

export type WritePipelineState = {
  stage: WritePipelineStage
  requiresApproval: boolean
  hasBackup: boolean
  canRollback: boolean
}

export const createWritePipelineState = (): WritePipelineState => {
  return {
    stage: 'diff',
    requiresApproval: true,
    hasBackup: false,
    canRollback: false,
  }
}
