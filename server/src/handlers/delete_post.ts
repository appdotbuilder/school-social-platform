import { db } from '../db';
import { postsTable, commentsTable, postLikesTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export async function deletePost(postId: number, userId: number, isAdmin: boolean = false): Promise<void> {
  try {
    // First, check if the post exists and get its details
    const posts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, postId))
      .execute();

    if (posts.length === 0) {
      throw new Error('Post not found');
    }

    const post = posts[0];

    // Check if the user is authorized to delete this post
    // User can delete if they are the author or an admin
    if (!isAdmin && post.author_id !== userId) {
      throw new Error('Unauthorized: You can only delete your own posts');
    }

    // Delete associated data first (comments and likes will cascade due to foreign key constraints)
    // But we'll explicitly delete them to ensure proper cleanup
    
    // Delete all comments for this post
    await db.delete(commentsTable)
      .where(eq(commentsTable.post_id, postId))
      .execute();

    // Delete all likes for this post
    await db.delete(postLikesTable)
      .where(eq(postLikesTable.post_id, postId))
      .execute();

    // Finally, delete the post itself
    await db.delete(postsTable)
      .where(eq(postsTable.id, postId))
      .execute();

  } catch (error) {
    console.error('Post deletion failed:', error);
    throw error;
  }
}