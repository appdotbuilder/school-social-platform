import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schema types
import {
  createUserInputSchema,
  updateUserInputSchema,
  createPostInputSchema,
  updatePostInputSchema,
  createPostLikeInputSchema,
  createCommentInputSchema,
  updateCommentInputSchema,
  createGroupInputSchema,
  updateGroupInputSchema,
  joinGroupInputSchema,
  sendMessageInputSchema,
  markMessageReadInputSchema
} from './schema';

// Import handlers
import { createUser } from './handlers/create_user';
import { getUsers } from './handlers/get_users';
import { updateUser } from './handlers/update_user';
import { createPost } from './handlers/create_post';
import { getNewsFeed } from './handlers/get_news_feed';
import { likePost, unlikePost } from './handlers/like_post';
import { createComment } from './handlers/create_comment';
import { getPostComments } from './handlers/get_post_comments';
import { createGroup } from './handlers/create_group';
import { joinGroup, leaveGroup } from './handlers/join_group';
import { getUserGroups } from './handlers/get_user_groups';
import { sendMessage } from './handlers/send_message';
import { getMessages, getConversations } from './handlers/get_messages';
import { markMessageRead, markAllMessagesRead } from './handlers/mark_message_read';
import { getAdminStats } from './handlers/get_admin_stats';
import { deletePost } from './handlers/delete_post';
import { deleteUser } from './handlers/delete_user';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User management routes
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  getUsers: publicProcedure
    .query(() => getUsers()),

  updateUser: publicProcedure
    .input(updateUserInputSchema)
    .mutation(({ input }) => updateUser(input)),

  deleteUser: publicProcedure
    .input(z.object({ userId: z.number(), adminId: z.number() }))
    .mutation(({ input }) => deleteUser(input.userId, input.adminId)),

  // Post management routes
  createPost: publicProcedure
    .input(createPostInputSchema.extend({ authorId: z.number() }))
    .mutation(({ input }) => createPost(input, input.authorId)),

  updatePost: publicProcedure
    .input(updatePostInputSchema)
    .mutation(({ input }) => {
      // Placeholder - should update post in database
      return Promise.resolve();
    }),

  deletePost: publicProcedure
    .input(z.object({ postId: z.number(), userId: z.number(), isAdmin: z.boolean().default(false) }))
    .mutation(({ input }) => deletePost(input.postId, input.userId, input.isAdmin)),

  getNewsFeed: publicProcedure
    .input(z.object({ 
      userId: z.number(),
      offset: z.number().optional(),
      limit: z.number().optional()
    }))
    .query(({ input }) => getNewsFeed(input.userId, input.offset, input.limit)),

  // Post interaction routes
  likePost: publicProcedure
    .input(createPostLikeInputSchema.extend({ userId: z.number() }))
    .mutation(({ input }) => likePost(input, input.userId)),

  unlikePost: publicProcedure
    .input(z.object({ postId: z.number(), userId: z.number() }))
    .mutation(({ input }) => unlikePost(input.postId, input.userId)),

  // Comment routes
  createComment: publicProcedure
    .input(createCommentInputSchema.extend({ authorId: z.number() }))
    .mutation(({ input }) => createComment(input, input.authorId)),

  updateComment: publicProcedure
    .input(updateCommentInputSchema)
    .mutation(({ input }) => {
      // Placeholder - should update comment in database
      return Promise.resolve();
    }),

  getPostComments: publicProcedure
    .input(z.object({ postId: z.number() }))
    .query(({ input }) => getPostComments(input.postId)),

  // Group management routes
  createGroup: publicProcedure
    .input(createGroupInputSchema.extend({ ownerId: z.number() }))
    .mutation(({ input }) => createGroup(input, input.ownerId)),

  updateGroup: publicProcedure
    .input(updateGroupInputSchema)
    .mutation(({ input }) => {
      // Placeholder - should update group in database
      return Promise.resolve();
    }),

  joinGroup: publicProcedure
    .input(joinGroupInputSchema.extend({ userId: z.number() }))
    .mutation(({ input }) => joinGroup(input, input.userId)),

  leaveGroup: publicProcedure
    .input(z.object({ groupId: z.number(), userId: z.number() }))
    .mutation(({ input }) => leaveGroup(input.groupId, input.userId)),

  getUserGroups: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getUserGroups(input.userId)),

  // Private messaging routes
  sendMessage: publicProcedure
    .input(sendMessageInputSchema.extend({ senderId: z.number() }))
    .mutation(({ input }) => sendMessage(input, input.senderId)),

  getMessages: publicProcedure
    .input(z.object({ 
      userId: z.number(),
      otherUserId: z.number().optional()
    }))
    .query(({ input }) => getMessages(input.userId, input.otherUserId)),

  getConversations: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getConversations(input.userId)),

  markMessageRead: publicProcedure
    .input(markMessageReadInputSchema.extend({ userId: z.number() }))
    .mutation(({ input }) => markMessageRead(input, input.userId)),

  markAllMessagesRead: publicProcedure
    .input(z.object({ senderId: z.number(), recipientId: z.number() }))
    .mutation(({ input }) => markAllMessagesRead(input.senderId, input.recipientId)),

  // Admin routes
  getAdminStats: publicProcedure
    .query(() => getAdminStats()),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();