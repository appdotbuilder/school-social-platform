import { db } from '../db';
import { commentsTable, postsTable } from '../db/schema';
import { type CreateCommentInput, type Comment } from '../schema';
import { eq, sql } from 'drizzle-orm';

export async function createComment(input: CreateCommentInput, authorId: number): Promise<Comment> {
  try {
    // Start a transaction to ensure both operations succeed
    const result = await db.transaction(async (tx) => {
      // First, verify the post exists
      const post = await tx.select()
        .from(postsTable)
        .where(eq(postsTable.id, input.post_id))
        .execute();

      if (post.length === 0) {
        throw new Error(`Post with id ${input.post_id} not found`);
      }

      // Create the comment
      const commentResult = await tx.insert(commentsTable)
        .values({
          post_id: input.post_id,
          author_id: authorId,
          content: input.content
        })
        .returning()
        .execute();

      // Increment the post's comment count
      await tx.update(postsTable)
        .set({
          comments_count: sql`${postsTable.comments_count} + 1`,
          updated_at: sql`now()`
        })
        .where(eq(postsTable.id, input.post_id))
        .execute();

      return commentResult[0];
    });

    return result;
  } catch (error) {
    console.error('Comment creation failed:', error);
    throw error;
  }
}