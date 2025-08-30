import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable, commentsTable, postLikesTable } from '../db/schema';
import { deletePost } from '../handlers/delete_post';
import { eq } from 'drizzle-orm';
describe('deletePost', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Create test users
  const createTestUser = async (email: string, role: 'admin' | 'student' | 'teacher' | 'alumni' = 'student') => {
    const result = await db.insert(usersTable)
      .values({
        email,
        password_hash: 'hashed_password_123',
        first_name: 'Test',
        last_name: 'User',
        role,
        profile_picture: null,
        bio: null,
        graduation_year: null,
        department: null,
        is_active: true
      })
      .returning()
      .execute();
    
    return result[0];
  };

  // Create test post
  const createTestPost = async (authorId: number, content: string = 'Test post content') => {
    const result = await db.insert(postsTable)
      .values({
        author_id: authorId,
        content,
        image_url: null,
        video_url: null,
        likes_count: 0,
        comments_count: 0
      })
      .returning()
      .execute();
    
    return result[0];
  };

  // Create test comment
  const createTestComment = async (postId: number, authorId: number) => {
    const result = await db.insert(commentsTable)
      .values({
        post_id: postId,
        author_id: authorId,
        content: 'Test comment'
      })
      .returning()
      .execute();
    
    return result[0];
  };

  // Create test like
  const createTestLike = async (postId: number, userId: number) => {
    const result = await db.insert(postLikesTable)
      .values({
        post_id: postId,
        user_id: userId
      })
      .returning()
      .execute();
    
    return result[0];
  };

  it('should delete a post when user is the author', async () => {
    const user = await createTestUser('author@test.com');
    const post = await createTestPost(user.id, 'Post to be deleted');

    await deletePost(post.id, user.id);

    // Verify post is deleted
    const posts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, post.id))
      .execute();

    expect(posts).toHaveLength(0);
  });

  it('should delete a post when user is admin', async () => {
    const author = await createTestUser('author@test.com', 'student');
    const admin = await createTestUser('admin@test.com', 'admin');
    const post = await createTestPost(author.id, 'Post to be deleted by admin');

    await deletePost(post.id, admin.id, true);

    // Verify post is deleted
    const posts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, post.id))
      .execute();

    expect(posts).toHaveLength(0);
  });

  it('should delete associated comments when deleting post', async () => {
    const author = await createTestUser('author@test.com');
    const commenter = await createTestUser('commenter@test.com');
    const post = await createTestPost(author.id);
    const comment = await createTestComment(post.id, commenter.id);

    await deletePost(post.id, author.id);

    // Verify comment is deleted
    const comments = await db.select()
      .from(commentsTable)
      .where(eq(commentsTable.id, comment.id))
      .execute();

    expect(comments).toHaveLength(0);

    // Verify post is deleted
    const posts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, post.id))
      .execute();

    expect(posts).toHaveLength(0);
  });

  it('should delete associated likes when deleting post', async () => {
    const author = await createTestUser('author@test.com');
    const liker = await createTestUser('liker@test.com');
    const post = await createTestPost(author.id);
    const like = await createTestLike(post.id, liker.id);

    await deletePost(post.id, author.id);

    // Verify like is deleted
    const likes = await db.select()
      .from(postLikesTable)
      .where(eq(postLikesTable.id, like.id))
      .execute();

    expect(likes).toHaveLength(0);

    // Verify post is deleted
    const posts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, post.id))
      .execute();

    expect(posts).toHaveLength(0);
  });

  it('should delete post with multiple comments and likes', async () => {
    const author = await createTestUser('author@test.com');
    const user1 = await createTestUser('user1@test.com');
    const user2 = await createTestUser('user2@test.com');
    const post = await createTestPost(author.id);

    // Create multiple comments and likes
    await createTestComment(post.id, user1.id);
    await createTestComment(post.id, user2.id);
    await createTestLike(post.id, user1.id);
    await createTestLike(post.id, user2.id);

    await deletePost(post.id, author.id);

    // Verify all related data is deleted
    const comments = await db.select()
      .from(commentsTable)
      .where(eq(commentsTable.post_id, post.id))
      .execute();

    const likes = await db.select()
      .from(postLikesTable)
      .where(eq(postLikesTable.post_id, post.id))
      .execute();

    const posts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, post.id))
      .execute();

    expect(comments).toHaveLength(0);
    expect(likes).toHaveLength(0);
    expect(posts).toHaveLength(0);
  });

  it('should throw error when post does not exist', async () => {
    const user = await createTestUser('user@test.com');
    const nonExistentPostId = 99999;

    await expect(deletePost(nonExistentPostId, user.id))
      .rejects.toThrow(/post not found/i);
  });

  it('should throw error when user is not the author and not admin', async () => {
    const author = await createTestUser('author@test.com');
    const otherUser = await createTestUser('other@test.com');
    const post = await createTestPost(author.id);

    await expect(deletePost(post.id, otherUser.id))
      .rejects.toThrow(/unauthorized/i);

    // Verify post still exists
    const posts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, post.id))
      .execute();

    expect(posts).toHaveLength(1);
  });

  it('should allow non-admin user to delete their own post', async () => {
    const regularUser = await createTestUser('regular@test.com', 'student');
    const post = await createTestPost(regularUser.id);

    await deletePost(post.id, regularUser.id, false);

    // Verify post is deleted
    const posts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, post.id))
      .execute();

    expect(posts).toHaveLength(0);
  });

  it('should handle deletion of post with no comments or likes', async () => {
    const user = await createTestUser('user@test.com');
    const post = await createTestPost(user.id);

    await deletePost(post.id, user.id);

    // Verify post is deleted
    const posts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, post.id))
      .execute();

    expect(posts).toHaveLength(0);
  });
});