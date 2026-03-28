import { SettingMigration } from '../setting.types'

export const migrateFrom16To17: SettingMigration['migrate'] = (data) => {
  const newData = { ...data }
  newData.version = 17

  delete newData.embeddingModels
  delete newData.embeddingModelId

  return newData
}
