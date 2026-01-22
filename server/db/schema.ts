import { integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: varchar('owner_id', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  icon: varchar('icon', { length: 50 }),
  color: varchar('color', { length: 50 }),
  vectorStoreId: varchar('vector_store_id', { length: 255 }),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const projectInstructions = pgTable('project_instructions', {
  projectId: uuid('project_id')
    .primaryKey()
    .references(() => projects.id, { onDelete: 'cascade' }),
  instructions: text('instructions'),
  updatedAt: timestamp('updated_at').defaultNow(),
  updatedBy: varchar('updated_by', { length: 255 }),
})

export const projectChats = pgTable('project_chats', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  createdBy: varchar('created_by', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
})

export const projectMessages = pgTable('project_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: uuid('chat_id')
    .notNull()
    .references(() => projectChats.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 32 }).notNull(),
  content: text('content').notNull(),
  rich: jsonb('rich'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }),
})

export const projectFiles = pgTable('project_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  sizeBytes: integer('size_bytes'),
  mimeType: varchar('mime_type', { length: 255 }),
  storageUrl: text('storage_url').notNull(),
  vectorStoreFileId: varchar('vector_store_file_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }),
  deletedAt: timestamp('deleted_at'),
})

export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
