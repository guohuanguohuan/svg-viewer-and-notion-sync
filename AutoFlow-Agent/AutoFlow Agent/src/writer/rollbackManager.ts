export type RollbackCheckpoint = {
  filePath: string
  backupPath: string
  createdAt: string
  sourceHash?: string
  candidateHash?: string
}

export const isRollbackReady = (
  checkpoint: RollbackCheckpoint | null | undefined,
): checkpoint is RollbackCheckpoint => {
  return Boolean(
    checkpoint &&
      checkpoint.filePath &&
      checkpoint.backupPath &&
      checkpoint.createdAt,
  )
}
