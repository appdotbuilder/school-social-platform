import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { postsTable, usersTable } from '../db/schema';
import { type CreatePostInput } from '../schema';
import { createPost } from '../handlers/create_post';
import { eq } from 'drizzle-orm';
// Test user data
const testUser = {
  email: 'testuser@example.com',
  password_hash: 'hashed_password_123',
  first_name: 'Test',
  last_name: 'User',
  role: 'student' as const,
  profile_picture: null,
  bio: null,
  graduation_year: 2024,
  department: null
};

// Simple test input
const testInput: CreatePostInput = {
  content: 'This is a test post content',
  image_url: 'https://example.com/image.jpg',
  video_url: null
};

const testInputWithVideo: CreatePostInput = {
  content: 'Post with video content',
  image_url: null,
  video_url: 'https://example.com/video.mp4'
};

const testInputTextOnly: CreatePostInput = {
  content: 'Just text content, no media',
  image_url: null,
  video_url: null
};

describe('createPost', () => {
  let userId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    userId = userResult[0].id;
  });

  afterEach(resetDB);

  it('should create a post with image', async () => {
    const result = await createPost(testInput, userId);

    // Basic field validation
    expect(result.content).toEqual('This is a test post content');
    expect(result.image_url).toEqual('https://example.com/image.jpg');
    expect(result.video_url).toBeNull();
    expect(result.author_id).toEqual(userId);
    expect(result.likes_count).toEqual(0);
    expect(result.comments_count).toEqual(0);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a post with video', async () => {
    const result = await createPost(testInputWithVideo, userId);

    expect(result.content).toEqual('Post with video content');
    expect(result.image_url).toBeNull();
    expect(result.video_url).toEqual('https://example.com/video.mp4');
    expect(result.author_id).toEqual(userId);
    expect(result.likes_count).toEqual(0);
    expect(result.comments_count).toEqual(0);
  });

  it('should create a text-only post', async () => {
    const result = await createPost(testInputTextOnly, userId);

    expect(result.content).toEqual('Just text content, no media');
    expect(result.image_url).toBeNull();
    expect(result.video_url).toBeNull();
    expect(result.author_id).toEqual(userId);
  });

  it('should save post to database', async () => {
    const result = await createPost(testInput, userId);

    // Query using proper drizzle syntax
    const posts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, result.id))
      .execute();

    expect(posts).toHaveLength(1);
    expect(posts[0].content).toEqual('This is a test post content');
    expect(posts[0].image_url).toEqual('https://example.com/image.jpg');
    expect(posts[0].author_id).toEqual(userId);
    expect(posts[0].likes_count).toEqual(0);
    expect(posts[0].comments_count).toEqual(0);
    expect(posts[0].created_at).toBeInstanceOf(Date);
    expect(posts[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle optional fields correctly', async () => {
    // Test with undefined optional fields (Zod should convert to null)
    const inputWithUndefined: CreatePostInput = {
      content: 'Test content',
      image_url: undefined,
      video_url: undefined
    };

    const result = await createPost(inputWithUndefined, userId);

    expect(result.image_url).toBeNull();
    expect(result.video_url).toBeNull();

    // Verify in database
    const posts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, result.id))
      .execute();

    expect(posts[0].image_url).toBeNull();
    expect(posts[0].video_url).toBeNull();
  });

  it('should create multiple posts for same user', async () => {
    const post1 = await createPost(testInput, userId);
    const post2 = await createPost(testInputWithVideo, userId);

    expect(post1.id).not.toEqual(post2.id);
    expect(post1.author_id).toEqual(userId);
    expect(post2.author_id).toEqual(userId);

    // Verify both posts exist in database
    const posts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.author_id, userId))
      .execute();

    expect(posts).toHaveLength(2);
    expect(posts.some(p => p.id === post1.id)).toBe(true);
    expect(posts.some(p => p.id === post2.id)).toBe(true);
  });

  it('should throw error for invalid author_id', async () => {
    const invalidUserId = 99999;

    await expect(createPost(testInput, invalidUserId))
      .rejects.toThrow(/violates foreign key constraint/i);
  });
});