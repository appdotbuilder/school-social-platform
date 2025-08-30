import { db } from '../db';
import { postsTable } from '../db/schema';
import { type CreatePostInput, type Post } from '../schema';

export async function createPost(input: CreatePostInput, authorId: number): Promise<Post> {
  try {
    // Insert post record
    const result = await db.insert(postsTable)
      .values({
        author_id: authorId,
        content: input.content,
        image_url: input.image_url || null,
        video_url: input.video_url || null,
        likes_count: 0,
        comments_count: 0
      })
      .returning()
      .execute();

    const post = result[0];
    return {
      ...post,
      // No numeric conversions needed - all fields are already correct types
    };
  } catch (error) {
    console.error('Post creation failed:', error);
    throw error;
  }
}