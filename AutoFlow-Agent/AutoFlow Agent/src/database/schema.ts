import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { SerializedLexicalNode } from 'lexical'

/* Template Table */
export type TemplateContent = {
  nodes: SerializedLexicalNode[]
}

export const templateTable = pgTable('template', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  content: jsonb('content').notNull().$type<TemplateContent>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type SelectTemplate = typeof templateTable.$inferSelect
export type InsertTemplate = typeof templateTable.$inferInsert
