import { serial, text, pgTable, timestamp, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// User role enum
export const userRoleEnum = pgEnum('user_role', ['admin', 'student', 'teacher', 'alumni']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  role: userRoleEnum('role').notNull(),
  profile_picture: text('profile_picture'), // Nullable by default
  bio: text('bio'), // Nullable by default
  graduation_year: integer('graduation_year'), // Nullable for students/alumni
  department: text('department'), // Nullable for teachers
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Posts table
export const postsTable = pgTable('posts', {
  id: serial('id').primaryKey(),
  author_id: integer('author_id').notNull().references(() => usersTable.id),
  content: text('content').notNull(),
  image_url: text('image_url'), // Nullable by default
  video_url: text('video_url'), // Nullable by default
  likes_count: integer('likes_count').notNull().default(0),
  comments_count: integer('comments_count').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Post likes table
export const postLikesTable = pgTable('post_likes', {
  id: serial('id').primaryKey(),
  post_id: integer('post_id').notNull().references(() => postsTable.id, { onDelete: 'cascade' }),
  user_id: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Comments table
export const commentsTable = pgTable('comments', {
  id: serial('id').primaryKey(),
  post_id: integer('post_id').notNull().references(() => postsTable.id, { onDelete: 'cascade' }),
  author_id: integer('author_id').notNull().references(() => usersTable.id),
  content: text('content').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Groups table
export const groupsTable = pgTable('groups', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'), // Nullable by default
  owner_id: integer('owner_id').notNull().references(() => usersTable.id),
  is_private: boolean('is_private').notNull().default(false),
  member_count: integer('member_count').notNull().default(1), // Owner is first member
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Group memberships table
export const groupMembershipsTable = pgTable('group_memberships', {
  id: serial('id').primaryKey(),
  group_id: integer('group_id').notNull().references(() => groupsTable.id, { onDelete: 'cascade' }),
  user_id: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  is_admin: boolean('is_admin').notNull().default(false),
  joined_at: timestamp('joined_at').defaultNow().notNull(),
});

// Private messages table
export const privateMessagesTable = pgTable('private_messages', {
  id: serial('id').primaryKey(),
  sender_id: integer('sender_id').notNull().references(() => usersTable.id),
  recipient_id: integer('recipient_id').notNull().references(() => usersTable.id),
  content: text('content').notNull(),
  is_read: boolean('is_read').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Define relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  posts: many(postsTable),
  comments: many(commentsTable),
  postLikes: many(postLikesTable),
  ownedGroups: many(groupsTable),
  groupMemberships: many(groupMembershipsTable),
  sentMessages: many(privateMessagesTable, { relationName: 'sentMessages' }),
  receivedMessages: many(privateMessagesTable, { relationName: 'receivedMessages' }),
}));

export const postsRelations = relations(postsTable, ({ one, many }) => ({
  author: one(usersTable, {
    fields: [postsTable.author_id],
    references: [usersTable.id],
  }),
  likes: many(postLikesTable),
  comments: many(commentsTable),
}));

export const postLikesRelations = relations(postLikesTable, ({ one }) => ({
  post: one(postsTable, {
    fields: [postLikesTable.post_id],
    references: [postsTable.id],
  }),
  user: one(usersTable, {
    fields: [postLikesTable.user_id],
    references: [usersTable.id],
  }),
}));

export const commentsRelations = relations(commentsTable, ({ one }) => ({
  post: one(postsTable, {
    fields: [commentsTable.post_id],
    references: [postsTable.id],
  }),
  author: one(usersTable, {
    fields: [commentsTable.author_id],
    references: [usersTable.id],
  }),
}));

export const groupsRelations = relations(groupsTable, ({ one, many }) => ({
  owner: one(usersTable, {
    fields: [groupsTable.owner_id],
    references: [usersTable.id],
  }),
  memberships: many(groupMembershipsTable),
}));

export const groupMembershipsRelations = relations(groupMembershipsTable, ({ one }) => ({
  group: one(groupsTable, {
    fields: [groupMembershipsTable.group_id],
    references: [groupsTable.id],
  }),
  user: one(usersTable, {
    fields: [groupMembershipsTable.user_id],
    references: [usersTable.id],
  }),
}));

export const privateMessagesRelations = relations(privateMessagesTable, ({ one }) => ({
  sender: one(usersTable, {
    fields: [privateMessagesTable.sender_id],
    references: [usersTable.id],
    relationName: 'sentMessages',
  }),
  recipient: one(usersTable, {
    fields: [privateMessagesTable.recipient_id],
    references: [usersTable.id],
    relationName: 'receivedMessages',
  }),
}));

// TypeScript types for tables
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type Post = typeof postsTable.$inferSelect;
export type NewPost = typeof postsTable.$inferInsert;
export type PostLike = typeof postLikesTable.$inferSelect;
export type NewPostLike = typeof postLikesTable.$inferInsert;
export type Comment = typeof commentsTable.$inferSelect;
export type NewComment = typeof commentsTable.$inferInsert;
export type Group = typeof groupsTable.$inferSelect;
export type NewGroup = typeof groupsTable.$inferInsert;
export type GroupMembership = typeof groupMembershipsTable.$inferSelect;
export type NewGroupMembership = typeof groupMembershipsTable.$inferInsert;
export type PrivateMessage = typeof privateMessagesTable.$inferSelect;
export type NewPrivateMessage = typeof privateMessagesTable.$inferInsert;

// Export all tables for relation queries
export const tables = {
  users: usersTable,
  posts: postsTable,
  postLikes: postLikesTable,
  comments: commentsTable,
  groups: groupsTable,
  groupMemberships: groupMembershipsTable,
  privateMessages: privateMessagesTable,
};