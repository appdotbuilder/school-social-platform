import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable, commentsTable } from '../db/schema';
import { getPostComments } from '../handlers/get_post_comments';
import type { CommentWithAuthor } from '../schema';

describe('getPostComments', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return comments for a specific post with author information', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'john@example.com',
          password_hash: 'hashed_password',
          first_name: 'John',
          last_name: 'Doe',
          role: 'student',
          is_active: true
        },
        {
          email: 'jane@example.com',
          password_hash: 'hashed_password',
          first_name: 'Jane',
          last_name: 'Smith',
          role: 'teacher',
          profile_picture: 'https://example.com/jane.jpg',
          is_active: true
        }
      ])
      .returning()
      .execute();

    // Create test post
    const post = await db.insert(postsTable)
      .values({
        author_id: users[0].id,
        content: 'Test post content'
      })
      .returning()
      .execute();

    // Create test comments
    const comments = await db.insert(commentsTable)
      .values([
        {
          post_id: post[0].id,
          author_id: users[0].id,
          content: 'First comment by John'
        },
        {
          post_id: post[0].id,
          author_id: users[1].id,
          content: 'Second comment by Jane'
        }
      ])
      .returning()
      .execute();

    const result = await getPostComments(post[0].id);

    expect(result).toHaveLength(2);
    
    // Verify first comment
    expect(result[0].id).toBe(comments[0].id);
    expect(result[0].post_id).toBe(post[0].id);
    expect(result[0].author_id).toBe(users[0].id);
    expect(result[0].author_first_name).toBe('John');
    expect(result[0].author_last_name).toBe('Doe');
    expect(result[0].author_profile_picture).toBeNull();
    expect(result[0].content).toBe('First comment by John');
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);

    // Verify second comment
    expect(result[1].id).toBe(comments[1].id);
    expect(result[1].post_id).toBe(post[0].id);
    expect(result[1].author_id).toBe(users[1].id);
    expect(result[1].author_first_name).toBe('Jane');
    expect(result[1].author_last_name).toBe('Smith');
    expect(result[1].author_profile_picture).toBe('https://example.com/jane.jpg');
    expect(result[1].content).toBe('Second comment by Jane');
    expect(result[1].created_at).toBeInstanceOf(Date);
    expect(result[1].updated_at).toBeInstanceOf(Date);
  });

  it('should return empty array for post with no comments', async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'student',
        is_active: true
      })
      .returning()
      .execute();

    // Create test post without comments
    const post = await db.insert(postsTable)
      .values({
        author_id: user[0].id,
        content: 'Post with no comments'
      })
      .returning()
      .execute();

    const result = await getPostComments(post[0].id);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return empty array for non-existent post', async () => {
    const result = await getPostComments(99999);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should order comments by creation time (oldest first)', async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'student',
        is_active: true
      })
      .returning()
      .execute();

    // Create test post
    const post = await db.insert(postsTable)
      .values({
        author_id: user[0].id,
        content: 'Test post'
      })
      .returning()
      .execute();

    // Create comments with slight delay to ensure different timestamps
    const firstComment = await db.insert(commentsTable)
      .values({
        post_id: post[0].id,
        author_id: user[0].id,
        content: 'First comment'
      })
      .returning()
      .execute();

    // Small delay to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 10));

    const secondComment = await db.insert(commentsTable)
      .values({
        post_id: post[0].id,
        author_id: user[0].id,
        content: 'Second comment'
      })
      .returning()
      .execute();

    const result = await getPostComments(post[0].id);

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('First comment');
    expect(result[1].content).toBe('Second comment');
    expect(result[0].created_at.getTime()).toBeLessThanOrEqual(result[1].created_at.getTime());
  });

  it('should only return comments for the specified post', async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'student',
        is_active: true
      })
      .returning()
      .execute();

    // Create two test posts
    const posts = await db.insert(postsTable)
      .values([
        {
          author_id: user[0].id,
          content: 'First post'
        },
        {
          author_id: user[0].id,
          content: 'Second post'
        }
      ])
      .returning()
      .execute();

    // Create comments for both posts
    await db.insert(commentsTable)
      .values([
        {
          post_id: posts[0].id,
          author_id: user[0].id,
          content: 'Comment on first post'
        },
        {
          post_id: posts[1].id,
          author_id: user[0].id,
          content: 'Comment on second post'
        }
      ])
      .execute();

    const result = await getPostComments(posts[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Comment on first post');
    expect(result[0].post_id).toBe(posts[0].id);
  });

  it('should handle comments from inactive users', async () => {
    // Create test users (one inactive)
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'active@example.com',
          password_hash: 'hashed_password',
          first_name: 'Active',
          last_name: 'User',
          role: 'student',
          is_active: true
        },
        {
          email: 'inactive@example.com',
          password_hash: 'hashed_password',
          first_name: 'Inactive',
          last_name: 'User',
          role: 'student',
          is_active: false
        }
      ])
      .returning()
      .execute();

    // Create test post
    const post = await db.insert(postsTable)
      .values({
        author_id: users[0].id,
        content: 'Test post'
      })
      .returning()
      .execute();

    // Create comment from inactive user
    await db.insert(commentsTable)
      .values({
        post_id: post[0].id,
        author_id: users[1].id,
        content: 'Comment from inactive user'
      })
      .execute();

    const result = await getPostComments(post[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].author_first_name).toBe('Inactive');
    expect(result[0].author_last_name).toBe('User');
    expect(result[0].content).toBe('Comment from inactive user');
  });
});