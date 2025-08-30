import { db } from '../db';
import { postsTable, usersTable, postLikesTable } from '../db/schema';
import { type PostWithAuthor } from '../schema';
import { desc, eq, and } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export async function getNewsFeed(userId: number, offset: number = 0, limit: number = 20): Promise<PostWithAuthor[]> {
  try {
    // Create alias for the like check subquery
    const userLikesAlias = alias(postLikesTable, 'user_likes');

    // Query posts with author information and like status
    const results = await db.select({
      // Post fields
      id: postsTable.id,
      author_id: postsTable.author_id,
      content: postsTable.content,
      image_url: postsTable.image_url,
      video_url: postsTable.video_url,
      likes_count: postsTable.likes_count,
      comments_count: postsTable.comments_count,
      created_at: postsTable.created_at,
      updated_at: postsTable.updated_at,
      // Author fields
      author_first_name: usersTable.first_name,
      author_last_name: usersTable.last_name,
      author_profile_picture: usersTable.profile_picture,
      // Like status for current user
      is_liked: userLikesAlias.id
    })
    .from(postsTable)
    .innerJoin(usersTable, eq(postsTable.author_id, usersTable.id))
    .leftJoin(
      userLikesAlias,
      and(
        eq(userLikesAlias.post_id, postsTable.id),
        eq(userLikesAlias.user_id, userId)
      )
    )
    .orderBy(desc(postsTable.created_at))
    .limit(limit)
    .offset(offset)
    .execute();

    // Transform results to match PostWithAuthor schema
    return results.map(result => ({
      id: result.id,
      author_id: result.author_id,
      author_first_name: result.author_first_name,
      author_last_name: result.author_last_name,
      author_profile_picture: result.author_profile_picture,
      content: result.content,
      image_url: result.image_url,
      video_url: result.video_url,
      likes_count: result.likes_count,
      comments_count: result.comments_count,
      is_liked: result.is_liked !== null, // Convert to boolean
      created_at: result.created_at,
      updated_at: result.updated_at
    }));
  } catch (error) {
    console.error('News feed fetch failed:', error);
    throw error;
  }
}