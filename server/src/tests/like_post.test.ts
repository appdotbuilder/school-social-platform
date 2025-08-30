import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable, postLikesTable } from '../db/schema';
import { type CreatePostLikeInput } from '../schema';
import { likePost, unlikePost } from '../handlers/like_post';
import { eq, and } from 'drizzle-orm';

describe('likePost and unlikePost', () => {
  let testUserId: number;
  let testPostId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'student'
      })
      .returning()
      .execute();
    
    testUserId = user[0].id;

    // Create test post
    const post = await db.insert(postsTable)
      .values({
        author_id: testUserId,
        content: 'Test post content',
        likes_count: 0,
        comments_count: 0
      })
      .returning()
      .execute();
    
    testPostId = post[0].id;
  });

  afterEach(resetDB);

  describe('likePost', () => {
    const testInput: CreatePostLikeInput = {
      post_id: 0 // Will be set dynamically in tests
    };

    it('should create a like for a post', async () => {
      testInput.post_id = testPostId;
      
      const result = await likePost(testInput, testUserId);

      // Verify like was created
      expect(result.post_id).toEqual(testPostId);
      expect(result.user_id).toEqual(testUserId);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should increment the post like count', async () => {
      testInput.post_id = testPostId;
      
      await likePost(testInput, testUserId);

      // Check that post like count was incremented
      const updatedPost = await db.select()
        .from(postsTable)
        .where(eq(postsTable.id, testPostId))
        .execute();

      expect(updatedPost[0].likes_count).toEqual(1);
    });

    it('should save like to database', async () => {
      testInput.post_id = testPostId;
      
      const result = await likePost(testInput, testUserId);

      // Query database to verify like was saved
      const likes = await db.select()
        .from(postLikesTable)
        .where(eq(postLikesTable.id, result.id))
        .execute();

      expect(likes).toHaveLength(1);
      expect(likes[0].post_id).toEqual(testPostId);
      expect(likes[0].user_id).toEqual(testUserId);
      expect(likes[0].created_at).toBeInstanceOf(Date);
    });

    it('should prevent duplicate likes from same user', async () => {
      testInput.post_id = testPostId;
      
      // Create first like
      const firstLike = await likePost(testInput, testUserId);
      
      // Try to like again
      const secondLike = await likePost(testInput, testUserId);

      // Should return the same like
      expect(firstLike.id).toEqual(secondLike.id);
      expect(firstLike.created_at).toEqual(secondLike.created_at);

      // Verify only one like exists in database
      const allLikes = await db.select()
        .from(postLikesTable)
        .where(
          and(
            eq(postLikesTable.post_id, testPostId),
            eq(postLikesTable.user_id, testUserId)
          )
        )
        .execute();

      expect(allLikes).toHaveLength(1);

      // Verify like count is still 1
      const post = await db.select()
        .from(postsTable)
        .where(eq(postsTable.id, testPostId))
        .execute();

      expect(post[0].likes_count).toEqual(1);
    });

    it('should throw error when post does not exist', async () => {
      testInput.post_id = 99999; // Non-existent post ID
      
      await expect(likePost(testInput, testUserId)).rejects.toThrow(/Post with id 99999 not found/i);
    });

    it('should allow different users to like the same post', async () => {
      // Create second user
      const secondUser = await db.insert(usersTable)
        .values({
          email: 'test2@example.com',
          password_hash: 'hashed_password',
          first_name: 'Test',
          last_name: 'User2',
          role: 'student'
        })
        .returning()
        .execute();

      testInput.post_id = testPostId;

      // Both users like the post
      await likePost(testInput, testUserId);
      await likePost(testInput, secondUser[0].id);

      // Verify both likes exist
      const allLikes = await db.select()
        .from(postLikesTable)
        .where(eq(postLikesTable.post_id, testPostId))
        .execute();

      expect(allLikes).toHaveLength(2);

      // Verify like count is 2
      const post = await db.select()
        .from(postsTable)
        .where(eq(postsTable.id, testPostId))
        .execute();

      expect(post[0].likes_count).toEqual(2);
    });
  });

  describe('unlikePost', () => {
    it('should remove a like from a post', async () => {
      // First create a like
      const testInput: CreatePostLikeInput = { post_id: testPostId };
      await likePost(testInput, testUserId);

      // Then unlike it
      await unlikePost(testPostId, testUserId);

      // Verify like was removed
      const likes = await db.select()
        .from(postLikesTable)
        .where(
          and(
            eq(postLikesTable.post_id, testPostId),
            eq(postLikesTable.user_id, testUserId)
          )
        )
        .execute();

      expect(likes).toHaveLength(0);
    });

    it('should decrement the post like count', async () => {
      // First create a like
      const testInput: CreatePostLikeInput = { post_id: testPostId };
      await likePost(testInput, testUserId);

      // Verify count is 1
      let post = await db.select()
        .from(postsTable)
        .where(eq(postsTable.id, testPostId))
        .execute();

      expect(post[0].likes_count).toEqual(1);

      // Unlike the post
      await unlikePost(testPostId, testUserId);

      // Verify count is back to 0
      post = await db.select()
        .from(postsTable)
        .where(eq(postsTable.id, testPostId))
        .execute();

      expect(post[0].likes_count).toEqual(0);
    });

    it('should handle unliking when no like exists (no-op)', async () => {
      // Try to unlike without creating a like first
      await expect(unlikePost(testPostId, testUserId)).resolves.toBeUndefined();

      // Verify post like count remains unchanged
      const post = await db.select()
        .from(postsTable)
        .where(eq(postsTable.id, testPostId))
        .execute();

      expect(post[0].likes_count).toEqual(0);
    });

    it('should not decrement like count below zero', async () => {
      // Manually set post like count to 0
      await db.update(postsTable)
        .set({ likes_count: 0 })
        .where(eq(postsTable.id, testPostId))
        .execute();

      // Try to unlike (should be no-op)
      await unlikePost(testPostId, testUserId);

      // Verify count stays at 0
      const post = await db.select()
        .from(postsTable)
        .where(eq(postsTable.id, testPostId))
        .execute();

      expect(post[0].likes_count).toEqual(0);
    });

    it('should only remove like from specific user', async () => {
      // Create second user
      const secondUser = await db.insert(usersTable)
        .values({
          email: 'test2@example.com',
          password_hash: 'hashed_password',
          first_name: 'Test',
          last_name: 'User2',
          role: 'student'
        })
        .returning()
        .execute();

      const testInput: CreatePostLikeInput = { post_id: testPostId };

      // Both users like the post
      await likePost(testInput, testUserId);
      await likePost(testInput, secondUser[0].id);

      // First user unlikes
      await unlikePost(testPostId, testUserId);

      // Verify only first user's like was removed
      const remainingLikes = await db.select()
        .from(postLikesTable)
        .where(eq(postLikesTable.post_id, testPostId))
        .execute();

      expect(remainingLikes).toHaveLength(1);
      expect(remainingLikes[0].user_id).toEqual(secondUser[0].id);

      // Verify like count is 1
      const post = await db.select()
        .from(postsTable)
        .where(eq(postsTable.id, testPostId))
        .execute();

      expect(post[0].likes_count).toEqual(1);
    });
  });
});