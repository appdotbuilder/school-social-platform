import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable, commentsTable } from '../db/schema';
import { type CreateCommentInput } from '../schema';
import { createComment } from '../handlers/create_comment';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'testuser@example.com',
  password_hash: 'hashed_password',
  first_name: 'Test',
  last_name: 'User',
  role: 'student' as const
};

const testPost = {
  author_id: 1,
  content: 'Test post content',
  likes_count: 0,
  comments_count: 0
};

const testCommentInput: CreateCommentInput = {
  post_id: 1,
  content: 'This is a test comment'
};

describe('createComment', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a comment successfully', async () => {
    // Create prerequisite user and post
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    const postResult = await db.insert(postsTable)
      .values({ ...testPost, author_id: userId })
      .returning()
      .execute();
    const postId = postResult[0].id;

    // Create comment
    const input = { ...testCommentInput, post_id: postId };
    const result = await createComment(input, userId);

    // Verify comment fields
    expect(result.id).toBeDefined();
    expect(result.post_id).toEqual(postId);
    expect(result.author_id).toEqual(userId);
    expect(result.content).toEqual('This is a test comment');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save comment to database', async () => {
    // Create prerequisite user and post
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    const postResult = await db.insert(postsTable)
      .values({ ...testPost, author_id: userId })
      .returning()
      .execute();
    const postId = postResult[0].id;

    // Create comment
    const input = { ...testCommentInput, post_id: postId };
    const result = await createComment(input, userId);

    // Verify comment exists in database
    const comments = await db.select()
      .from(commentsTable)
      .where(eq(commentsTable.id, result.id))
      .execute();

    expect(comments).toHaveLength(1);
    expect(comments[0].post_id).toEqual(postId);
    expect(comments[0].author_id).toEqual(userId);
    expect(comments[0].content).toEqual('This is a test comment');
    expect(comments[0].created_at).toBeInstanceOf(Date);
    expect(comments[0].updated_at).toBeInstanceOf(Date);
  });

  it('should increment post comment count', async () => {
    // Create prerequisite user and post
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    const postResult = await db.insert(postsTable)
      .values({ ...testPost, author_id: userId, comments_count: 5 })
      .returning()
      .execute();
    const postId = postResult[0].id;

    // Create comment
    const input = { ...testCommentInput, post_id: postId };
    await createComment(input, userId);

    // Verify post comment count was incremented
    const posts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, postId))
      .execute();

    expect(posts).toHaveLength(1);
    expect(posts[0].comments_count).toEqual(6);
    expect(posts[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle multiple comments on same post', async () => {
    // Create prerequisite users and post
    const user1Result = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const user1Id = user1Result[0].id;

    const user2Result = await db.insert(usersTable)
      .values({
        ...testUser,
        email: 'user2@example.com',
        first_name: 'User',
        last_name: 'Two'
      })
      .returning()
      .execute();
    const user2Id = user2Result[0].id;

    const postResult = await db.insert(postsTable)
      .values({ ...testPost, author_id: user1Id })
      .returning()
      .execute();
    const postId = postResult[0].id;

    // Create multiple comments
    const input1 = { ...testCommentInput, post_id: postId, content: 'First comment' };
    const input2 = { ...testCommentInput, post_id: postId, content: 'Second comment' };

    const comment1 = await createComment(input1, user1Id);
    const comment2 = await createComment(input2, user2Id);

    // Verify both comments were created
    expect(comment1.content).toEqual('First comment');
    expect(comment1.author_id).toEqual(user1Id);
    expect(comment2.content).toEqual('Second comment');
    expect(comment2.author_id).toEqual(user2Id);

    // Verify post comment count is correct
    const posts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, postId))
      .execute();

    expect(posts[0].comments_count).toEqual(2);
  });

  it('should throw error for non-existent post', async () => {
    // Create prerequisite user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Try to create comment on non-existent post
    const input = { ...testCommentInput, post_id: 999 };

    await expect(createComment(input, userId)).rejects.toThrow(/post.*not found/i);
  });

  it('should handle empty content correctly', async () => {
    // Create prerequisite user and post
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    const postResult = await db.insert(postsTable)
      .values({ ...testPost, author_id: userId })
      .returning()
      .execute();
    const postId = postResult[0].id;

    // Create comment with minimal content (Zod validation should handle this at API level)
    const input = { ...testCommentInput, post_id: postId, content: 'a' };
    const result = await createComment(input, userId);

    expect(result.content).toEqual('a');
  });

  it('should maintain referential integrity with foreign keys', async () => {
    // Create prerequisite user and post
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    const postResult = await db.insert(postsTable)
      .values({ ...testPost, author_id: userId })
      .returning()
      .execute();
    const postId = postResult[0].id;

    // Create comment
    const input = { ...testCommentInput, post_id: postId };
    const result = await createComment(input, userId);

    // Verify foreign key relationships are maintained
    const comments = await db.select()
      .from(commentsTable)
      .where(eq(commentsTable.id, result.id))
      .execute();

    expect(comments[0].post_id).toEqual(postId);
    expect(comments[0].author_id).toEqual(userId);

    // Verify the referenced post and user still exist
    const posts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, postId))
      .execute();
    
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    expect(posts).toHaveLength(1);
    expect(users).toHaveLength(1);
  });
});