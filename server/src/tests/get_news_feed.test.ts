import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable, postLikesTable } from '../db/schema';
import { getNewsFeed } from '../handlers/get_news_feed';
import { eq } from 'drizzle-orm';

describe('getNewsFeed', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUser: any;
  let author1: any;
  let author2: any;

  beforeEach(async () => {
    // Create test users
    const userResults = await db.insert(usersTable)
      .values([
        {
          email: 'user@test.com',
          password_hash: 'hash123',
          first_name: 'Test',
          last_name: 'User',
          role: 'student'
        },
        {
          email: 'author1@test.com',
          password_hash: 'hash123',
          first_name: 'John',
          last_name: 'Doe',
          role: 'student',
          profile_picture: 'https://example.com/john.jpg'
        },
        {
          email: 'author2@test.com',
          password_hash: 'hash123',
          first_name: 'Jane',
          last_name: 'Smith',
          role: 'teacher'
        }
      ])
      .returning()
      .execute();

    testUser = userResults[0];
    author1 = userResults[1];
    author2 = userResults[2];
  });

  it('should return empty array when no posts exist', async () => {
    const result = await getNewsFeed(testUser.id);

    expect(result).toEqual([]);
  });

  it('should fetch posts with author information', async () => {
    // Create a test post
    await db.insert(postsTable)
      .values({
        author_id: author1.id,
        content: 'Hello world!',
        image_url: 'https://example.com/image.jpg',
        likes_count: 5,
        comments_count: 3
      })
      .execute();

    const result = await getNewsFeed(testUser.id);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      author_id: author1.id,
      author_first_name: 'John',
      author_last_name: 'Doe',
      author_profile_picture: 'https://example.com/john.jpg',
      content: 'Hello world!',
      image_url: 'https://example.com/image.jpg',
      video_url: null,
      likes_count: 5,
      comments_count: 3,
      is_liked: false
    });
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });

  it('should show correct like status for current user', async () => {
    // Create posts from different authors
    const postResults = await db.insert(postsTable)
      .values([
        {
          author_id: author1.id,
          content: 'Post 1',
          likes_count: 1
        },
        {
          author_id: author2.id,
          content: 'Post 2',
          likes_count: 0
        }
      ])
      .returning()
      .execute();

    // User likes the first post
    await db.insert(postLikesTable)
      .values({
        post_id: postResults[0].id,
        user_id: testUser.id
      })
      .execute();

    const result = await getNewsFeed(testUser.id);

    expect(result).toHaveLength(2);
    
    // Find posts by content to verify like status
    const post1 = result.find(p => p.content === 'Post 1');
    const post2 = result.find(p => p.content === 'Post 2');

    expect(post1?.is_liked).toBe(true);
    expect(post2?.is_liked).toBe(false);
  });

  it('should return posts ordered by creation date (most recent first)', async () => {
    // Create posts with slight delay to ensure different timestamps
    const post1 = await db.insert(postsTable)
      .values({
        author_id: author1.id,
        content: 'First post'
      })
      .returning()
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const post2 = await db.insert(postsTable)
      .values({
        author_id: author2.id,
        content: 'Second post'
      })
      .returning()
      .execute();

    const result = await getNewsFeed(testUser.id);

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('Second post'); // Most recent first
    expect(result[1].content).toBe('First post');
    expect(result[0].created_at >= result[1].created_at).toBe(true);
  });

  it('should respect pagination with limit and offset', async () => {
    // Create multiple posts
    const posts = [];
    for (let i = 0; i < 5; i++) {
      posts.push({
        author_id: i % 2 === 0 ? author1.id : author2.id,
        content: `Post ${i + 1}`
      });
    }

    await db.insert(postsTable)
      .values(posts)
      .execute();

    // Test first page
    const page1 = await getNewsFeed(testUser.id, 0, 3);
    expect(page1).toHaveLength(3);

    // Test second page
    const page2 = await getNewsFeed(testUser.id, 3, 3);
    expect(page2).toHaveLength(2);

    // Verify no overlap between pages
    const page1Ids = page1.map(p => p.id);
    const page2Ids = page2.map(p => p.id);
    const hasOverlap = page1Ids.some(id => page2Ids.includes(id));
    expect(hasOverlap).toBe(false);
  });

  it('should use default pagination values', async () => {
    // Create 25 posts (more than default limit of 20)
    const posts = [];
    for (let i = 0; i < 25; i++) {
      posts.push({
        author_id: i % 2 === 0 ? author1.id : author2.id,
        content: `Post ${i + 1}`
      });
    }

    await db.insert(postsTable)
      .values(posts)
      .execute();

    // Test without parameters (should use defaults: offset=0, limit=20)
    const result = await getNewsFeed(testUser.id);
    expect(result).toHaveLength(20);
  });

  it('should handle posts with null optional fields', async () => {
    // Create post with minimal data (null image_url, video_url)
    await db.insert(postsTable)
      .values({
        author_id: author2.id,
        content: 'Minimal post',
        // image_url and video_url are null by default
        likes_count: 0,
        comments_count: 0
      })
      .execute();

    const result = await getNewsFeed(testUser.id);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      content: 'Minimal post',
      image_url: null,
      video_url: null,
      author_profile_picture: null, // author2 has no profile picture
      likes_count: 0,
      comments_count: 0,
      is_liked: false
    });
  });

  it('should handle mixed author profile data', async () => {
    // Create posts from authors with different profile completeness
    await db.insert(postsTable)
      .values([
        {
          author_id: author1.id, // Has profile picture
          content: 'Post with profile pic'
        },
        {
          author_id: author2.id, // No profile picture
          content: 'Post without profile pic'
        }
      ])
      .execute();

    const result = await getNewsFeed(testUser.id);

    expect(result).toHaveLength(2);
    
    const postWithPic = result.find(p => p.content === 'Post with profile pic');
    const postWithoutPic = result.find(p => p.content === 'Post without profile pic');

    expect(postWithPic?.author_profile_picture).toBe('https://example.com/john.jpg');
    expect(postWithoutPic?.author_profile_picture).toBe(null);
  });
});