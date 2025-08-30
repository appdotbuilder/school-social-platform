import { db } from '../db';
import { postLikesTable, postsTable } from '../db/schema';
import { type CreatePostLikeInput, type PostLike } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function likePost(input: CreatePostLikeInput, userId: number): Promise<PostLike> {
  try {
    // Check if user has already liked this post
    const existingLike = await db.select()
      .from(postLikesTable)
      .where(
        and(
          eq(postLikesTable.post_id, input.post_id),
          eq(postLikesTable.user_id, userId)
        )
      )
      .execute();

    if (existingLike.length > 0) {
      // Return existing like instead of creating duplicate
      return existingLike[0];
    }

    // Verify post exists before creating like
    const postExists = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, input.post_id))
      .execute();

    if (postExists.length === 0) {
      throw new Error(`Post with id ${input.post_id} not found`);
    }

    // Create the like
    const result = await db.insert(postLikesTable)
      .values({
        post_id: input.post_id,
        user_id: userId
      })
      .returning()
      .execute();

    // Increment the post's like count (only if this is a new like)
    await db.update(postsTable)
      .set({
        likes_count: postExists[0].likes_count + 1
      })
      .where(eq(postsTable.id, input.post_id))
      .execute();

    return result[0];
  } catch (error) {
    console.error('Like post failed:', error);
    throw error;
  }
}

export async function unlikePost(postId: number, userId: number): Promise<void> {
  try {
    // Check if like exists
    const existingLike = await db.select()
      .from(postLikesTable)
      .where(
        and(
          eq(postLikesTable.post_id, postId),
          eq(postLikesTable.user_id, userId)
        )
      )
      .execute();

    if (existingLike.length === 0) {
      // No like to remove - this is a no-op
      return;
    }

    // Delete the like
    await db.delete(postLikesTable)
      .where(
        and(
          eq(postLikesTable.post_id, postId),
          eq(postLikesTable.user_id, userId)
        )
      )
      .execute();

    // Decrement the post's like count
    await db.update(postsTable)
      .set({
        likes_count: Math.max(0, (await db.select()
          .from(postsTable)
          .where(eq(postsTable.id, postId))
          .execute())[0]?.likes_count - 1 || 0)
      })
      .where(eq(postsTable.id, postId))
      .execute();
  } catch (error) {
    console.error('Unlike post failed:', error);
    throw error;
  }
}