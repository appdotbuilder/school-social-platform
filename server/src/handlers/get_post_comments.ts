import { db } from '../db';
import { commentsTable, usersTable } from '../db/schema';
import { type CommentWithAuthor } from '../schema';
import { eq } from 'drizzle-orm';

export async function getPostComments(postId: number): Promise<CommentWithAuthor[]> {
  try {
    // Join comments with users to get author information, ordered by creation time
    const results = await db.select({
      id: commentsTable.id,
      post_id: commentsTable.post_id,
      author_id: commentsTable.author_id,
      author_first_name: usersTable.first_name,
      author_last_name: usersTable.last_name,
      author_profile_picture: usersTable.profile_picture,
      content: commentsTable.content,
      created_at: commentsTable.created_at,
      updated_at: commentsTable.updated_at
    })
    .from(commentsTable)
    .innerJoin(usersTable, eq(commentsTable.author_id, usersTable.id))
    .where(eq(commentsTable.post_id, postId))
    .orderBy(commentsTable.created_at)
    .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch post comments:', error);
    throw error;
  }
}