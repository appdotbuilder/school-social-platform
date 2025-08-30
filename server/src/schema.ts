import { z } from 'zod';

// User role enum
export const userRoleSchema = z.enum(['admin', 'student', 'teacher', 'alumni']);
export type UserRole = z.infer<typeof userRoleSchema>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  role: userRoleSchema,
  profile_picture: z.string().nullable(),
  bio: z.string().nullable(),
  graduation_year: z.number().int().nullable(), // For students/alumni
  department: z.string().nullable(), // For teachers
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Input schemas for user operations
export const createUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  role: userRoleSchema,
  profile_picture: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  graduation_year: z.number().int().nullable().optional(),
  department: z.string().nullable().optional()
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const updateUserInputSchema = z.object({
  id: z.number(),
  email: z.string().email().optional(),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  profile_picture: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  graduation_year: z.number().int().nullable().optional(),
  department: z.string().nullable().optional(),
  is_active: z.boolean().optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

// Post schema
export const postSchema = z.object({
  id: z.number(),
  author_id: z.number(),
  content: z.string(),
  image_url: z.string().nullable(),
  video_url: z.string().nullable(),
  likes_count: z.number().int(),
  comments_count: z.number().int(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Post = z.infer<typeof postSchema>;

export const createPostInputSchema = z.object({
  content: z.string().min(1),
  image_url: z.string().nullable().optional(),
  video_url: z.string().nullable().optional()
});

export type CreatePostInput = z.infer<typeof createPostInputSchema>;

export const updatePostInputSchema = z.object({
  id: z.number(),
  content: z.string().min(1).optional(),
  image_url: z.string().nullable().optional(),
  video_url: z.string().nullable().optional()
});

export type UpdatePostInput = z.infer<typeof updatePostInputSchema>;

// Post like schema
export const postLikeSchema = z.object({
  id: z.number(),
  post_id: z.number(),
  user_id: z.number(),
  created_at: z.coerce.date()
});

export type PostLike = z.infer<typeof postLikeSchema>;

export const createPostLikeInputSchema = z.object({
  post_id: z.number()
});

export type CreatePostLikeInput = z.infer<typeof createPostLikeInputSchema>;

// Comment schema
export const commentSchema = z.object({
  id: z.number(),
  post_id: z.number(),
  author_id: z.number(),
  content: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Comment = z.infer<typeof commentSchema>;

export const createCommentInputSchema = z.object({
  post_id: z.number(),
  content: z.string().min(1)
});

export type CreateCommentInput = z.infer<typeof createCommentInputSchema>;

export const updateCommentInputSchema = z.object({
  id: z.number(),
  content: z.string().min(1)
});

export type UpdateCommentInput = z.infer<typeof updateCommentInputSchema>;

// Group schema
export const groupSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  owner_id: z.number(),
  is_private: z.boolean(),
  member_count: z.number().int(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Group = z.infer<typeof groupSchema>;

export const createGroupInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  is_private: z.boolean().default(false)
});

export type CreateGroupInput = z.infer<typeof createGroupInputSchema>;

export const updateGroupInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  is_private: z.boolean().optional()
});

export type UpdateGroupInput = z.infer<typeof updateGroupInputSchema>;

// Group membership schema
export const groupMembershipSchema = z.object({
  id: z.number(),
  group_id: z.number(),
  user_id: z.number(),
  is_admin: z.boolean(),
  joined_at: z.coerce.date()
});

export type GroupMembership = z.infer<typeof groupMembershipSchema>;

export const joinGroupInputSchema = z.object({
  group_id: z.number()
});

export type JoinGroupInput = z.infer<typeof joinGroupInputSchema>;

// Private message schema
export const privateMessageSchema = z.object({
  id: z.number(),
  sender_id: z.number(),
  recipient_id: z.number(),
  content: z.string(),
  is_read: z.boolean(),
  created_at: z.coerce.date()
});

export type PrivateMessage = z.infer<typeof privateMessageSchema>;

export const sendMessageInputSchema = z.object({
  recipient_id: z.number(),
  content: z.string().min(1)
});

export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;

export const markMessageReadInputSchema = z.object({
  message_id: z.number()
});

export type MarkMessageReadInput = z.infer<typeof markMessageReadInputSchema>;

// Post with author info (for feed)
export const postWithAuthorSchema = z.object({
  id: z.number(),
  author_id: z.number(),
  author_first_name: z.string(),
  author_last_name: z.string(),
  author_profile_picture: z.string().nullable(),
  content: z.string(),
  image_url: z.string().nullable(),
  video_url: z.string().nullable(),
  likes_count: z.number().int(),
  comments_count: z.number().int(),
  is_liked: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type PostWithAuthor = z.infer<typeof postWithAuthorSchema>;

// Comment with author info
export const commentWithAuthorSchema = z.object({
  id: z.number(),
  post_id: z.number(),
  author_id: z.number(),
  author_first_name: z.string(),
  author_last_name: z.string(),
  author_profile_picture: z.string().nullable(),
  content: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type CommentWithAuthor = z.infer<typeof commentWithAuthorSchema>;

// Admin dashboard stats schema
export const adminStatsSchema = z.object({
  total_users: z.number().int(),
  total_posts: z.number().int(),
  total_groups: z.number().int(),
  active_users_today: z.number().int(),
  users_by_role: z.object({
    admin: z.number().int(),
    student: z.number().int(),
    teacher: z.number().int(),
    alumni: z.number().int()
  })
});

export type AdminStats = z.infer<typeof adminStatsSchema>;