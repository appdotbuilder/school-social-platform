import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable, commentsTable, groupsTable, groupMembershipsTable, privateMessagesTable } from '../db/schema';
import { deleteUser } from '../handlers/delete_user';
import { eq, and } from 'drizzle-orm';


// Test data
const adminUser = {
  email: 'admin@test.com',
  password_hash: 'hashedpassword',
  first_name: 'Admin',
  last_name: 'User',
  role: 'admin' as const,
  is_active: true
};

const targetUser = {
  email: 'student@test.com',
  password_hash: 'hashedpassword',
  first_name: 'Student',
  last_name: 'User',
  role: 'student' as const,
  is_active: true
};

const anotherUser = {
  email: 'teacher@test.com',
  password_hash: 'hashedpassword',
  first_name: 'Teacher',
  last_name: 'User',
  role: 'teacher' as const,
  is_active: true
};

describe('deleteUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let adminId: number;
  let targetUserId: number;
  let anotherUserId: number;

  beforeEach(async () => {
    // Create test users
    const adminResult = await db.insert(usersTable)
      .values(adminUser)
      .returning()
      .execute();
    adminId = adminResult[0].id;

    const targetResult = await db.insert(usersTable)
      .values(targetUser)
      .returning()
      .execute();
    targetUserId = targetResult[0].id;

    const anotherResult = await db.insert(usersTable)
      .values(anotherUser)
      .returning()
      .execute();
    anotherUserId = anotherResult[0].id;
  });

  it('should deactivate user when admin deletes user', async () => {
    await deleteUser(targetUserId, adminId);

    // Verify user is deactivated
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, targetUserId))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].is_active).toBe(false);
    expect(users[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error when non-admin tries to delete user', async () => {
    await expect(deleteUser(targetUserId, anotherUserId))
      .rejects.toThrow(/unauthorized.*admin/i);
  });

  it('should throw error when admin user is not found', async () => {
    await expect(deleteUser(targetUserId, 999))
      .rejects.toThrow(/unauthorized.*admin/i);
  });

  it('should throw error when target user is not found', async () => {
    await expect(deleteUser(999, adminId))
      .rejects.toThrow(/user not found/i);
  });

  it('should throw error when trying to delete admin user', async () => {
    // Create another admin user
    const adminUser2 = await db.insert(usersTable)
      .values({
        ...targetUser,
        email: 'admin2@test.com',
        role: 'admin' as const
      })
      .returning()
      .execute();

    await expect(deleteUser(adminUser2[0].id, adminId))
      .rejects.toThrow(/cannot delete admin users/i);
  });

  it('should remove user from group memberships and update member counts', async () => {
    // Create a group owned by another user
    const group = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        owner_id: anotherUserId,
        member_count: 2
      })
      .returning()
      .execute();

    // Add owner as member (owners should be members)
    await db.insert(groupMembershipsTable)
      .values({
        group_id: group[0].id,
        user_id: anotherUserId,
        is_admin: true
      })
      .execute();

    // Add target user as member
    await db.insert(groupMembershipsTable)
      .values({
        group_id: group[0].id,
        user_id: targetUserId,
        is_admin: false
      })
      .execute();

    await deleteUser(targetUserId, adminId);

    // Verify target user membership is removed
    const memberships = await db.select()
      .from(groupMembershipsTable)
      .where(eq(groupMembershipsTable.user_id, targetUserId))
      .execute();

    expect(memberships).toHaveLength(0);

    // Verify member count is updated (only owner remains)
    const updatedGroups = await db.select()
      .from(groupsTable)
      .where(eq(groupsTable.id, group[0].id))
      .execute();

    expect(updatedGroups[0].member_count).toBe(1);
  });

  it('should transfer group ownership to admin member when owner is deleted', async () => {
    // Create a group owned by target user
    const group = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        owner_id: targetUserId,
        member_count: 2
      })
      .returning()
      .execute();

    // Add target user as owner member
    await db.insert(groupMembershipsTable)
      .values({
        group_id: group[0].id,
        user_id: targetUserId,
        is_admin: true
      })
      .execute();

    // Add another user as admin member
    await db.insert(groupMembershipsTable)
      .values({
        group_id: group[0].id,
        user_id: anotherUserId,
        is_admin: true
      })
      .execute();

    await deleteUser(targetUserId, adminId);

    // Verify ownership transferred
    const updatedGroups = await db.select()
      .from(groupsTable)
      .where(eq(groupsTable.id, group[0].id))
      .execute();

    expect(updatedGroups[0].owner_id).toBe(anotherUserId);
    expect(updatedGroups[0].updated_at).toBeInstanceOf(Date);
  });

  it('should promote regular member to admin and transfer ownership when no admin members exist', async () => {
    // Create a group owned by target user
    const group = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        owner_id: targetUserId,
        member_count: 2
      })
      .returning()
      .execute();

    // Add target user as owner member
    await db.insert(groupMembershipsTable)
      .values({
        group_id: group[0].id,
        user_id: targetUserId,
        is_admin: true
      })
      .execute();

    // Add another user as regular member
    const membership = await db.insert(groupMembershipsTable)
      .values({
        group_id: group[0].id,
        user_id: anotherUserId,
        is_admin: false
      })
      .returning()
      .execute();

    await deleteUser(targetUserId, adminId);

    // Verify ownership transferred and member promoted
    const updatedGroups = await db.select()
      .from(groupsTable)
      .where(eq(groupsTable.id, group[0].id))
      .execute();

    expect(updatedGroups[0].owner_id).toBe(anotherUserId);

    // Verify member was promoted to admin
    const updatedMemberships = await db.select()
      .from(groupMembershipsTable)
      .where(eq(groupMembershipsTable.id, membership[0].id))
      .execute();

    expect(updatedMemberships[0].is_admin).toBe(true);
  });

  it('should delete empty group when owner is deleted and no other members exist', async () => {
    // Create a group owned by target user with no other members
    const group = await db.insert(groupsTable)
      .values({
        name: 'Empty Group',
        owner_id: targetUserId,
        member_count: 1
      })
      .returning()
      .execute();

    await deleteUser(targetUserId, adminId);

    // Verify group is deleted
    const remainingGroups = await db.select()
      .from(groupsTable)
      .where(eq(groupsTable.id, group[0].id))
      .execute();

    expect(remainingGroups).toHaveLength(0);
  });

  it('should delete private messages sent and received by user', async () => {
    // Create messages sent by target user
    await db.insert(privateMessagesTable)
      .values({
        sender_id: targetUserId,
        recipient_id: anotherUserId,
        content: 'Message from target user',
        is_read: false
      })
      .execute();

    // Create messages received by target user
    await db.insert(privateMessagesTable)
      .values({
        sender_id: anotherUserId,
        recipient_id: targetUserId,
        content: 'Message to target user',
        is_read: false
      })
      .execute();

    await deleteUser(targetUserId, adminId);

    // Verify all messages involving target user are deleted
    const sentMessages = await db.select()
      .from(privateMessagesTable)
      .where(eq(privateMessagesTable.sender_id, targetUserId))
      .execute();

    const receivedMessages = await db.select()
      .from(privateMessagesTable)
      .where(eq(privateMessagesTable.recipient_id, targetUserId))
      .execute();

    expect(sentMessages).toHaveLength(0);
    expect(receivedMessages).toHaveLength(0);
  });

  it('should keep posts and comments but update timestamps', async () => {
    // Create post by target user
    const post = await db.insert(postsTable)
      .values({
        author_id: targetUserId,
        content: 'Test post content',
        likes_count: 0,
        comments_count: 0
      })
      .returning()
      .execute();

    // Create comment by target user
    const comment = await db.insert(commentsTable)
      .values({
        post_id: post[0].id,
        author_id: targetUserId,
        content: 'Test comment content'
      })
      .returning()
      .execute();

    const originalPostTime = post[0].updated_at;
    const originalCommentTime = comment[0].updated_at;

    // Wait a moment to ensure timestamps are different
    await new Promise(resolve => setTimeout(resolve, 10));

    await deleteUser(targetUserId, adminId);

    // Verify posts and comments still exist but with updated timestamps
    const remainingPosts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, post[0].id))
      .execute();

    const remainingComments = await db.select()
      .from(commentsTable)
      .where(eq(commentsTable.id, comment[0].id))
      .execute();

    expect(remainingPosts).toHaveLength(1);
    expect(remainingComments).toHaveLength(1);
    expect(remainingPosts[0].author_id).toBe(targetUserId);
    expect(remainingComments[0].author_id).toBe(targetUserId);
    
    // Verify timestamps were updated
    expect(remainingPosts[0].updated_at.getTime()).toBeGreaterThan(originalPostTime.getTime());
    expect(remainingComments[0].updated_at.getTime()).toBeGreaterThan(originalCommentTime.getTime());
  });

  it('should handle complex scenario with multiple group ownerships and memberships', async () => {
    // Create multiple groups with different configurations
    const group1 = await db.insert(groupsTable)
      .values({
        name: 'Group with Admin Member',
        owner_id: targetUserId,
        member_count: 2
      })
      .returning()
      .execute();

    const group2 = await db.insert(groupsTable)
      .values({
        name: 'Group with Regular Member',
        owner_id: targetUserId,
        member_count: 2
      })
      .returning()
      .execute();

    const group3 = await db.insert(groupsTable)
      .values({
        name: 'Empty Group',
        owner_id: targetUserId,
        member_count: 1
      })
      .returning()
      .execute();

    // Add target user as owner member for group1
    await db.insert(groupMembershipsTable)
      .values({
        group_id: group1[0].id,
        user_id: targetUserId,
        is_admin: true
      })
      .execute();

    // Add admin member to group1
    await db.insert(groupMembershipsTable)
      .values({
        group_id: group1[0].id,
        user_id: anotherUserId,
        is_admin: true
      })
      .execute();

    // Add target user as owner member for group2
    await db.insert(groupMembershipsTable)
      .values({
        group_id: group2[0].id,
        user_id: targetUserId,
        is_admin: true
      })
      .execute();

    // Add regular member to group2
    await db.insert(groupMembershipsTable)
      .values({
        group_id: group2[0].id,
        user_id: anotherUserId,
        is_admin: false
      })
      .execute();

    // Add target user as owner member for group3 (no other members)
    await db.insert(groupMembershipsTable)
      .values({
        group_id: group3[0].id,
        user_id: targetUserId,
        is_admin: true
      })
      .execute();

    await deleteUser(targetUserId, adminId);

    // Verify group1: ownership transferred to admin member
    const updatedGroup1 = await db.select()
      .from(groupsTable)
      .where(eq(groupsTable.id, group1[0].id))
      .execute();
    expect(updatedGroup1[0].owner_id).toBe(anotherUserId);

    // Verify group2: ownership transferred and member promoted
    const updatedGroup2 = await db.select()
      .from(groupsTable)
      .where(eq(groupsTable.id, group2[0].id))
      .execute();
    expect(updatedGroup2[0].owner_id).toBe(anotherUserId);

    const promotedMember = await db.select()
      .from(groupMembershipsTable)
      .where(and(
        eq(groupMembershipsTable.group_id, group2[0].id),
        eq(groupMembershipsTable.user_id, anotherUserId)
      ))
      .execute();
    expect(promotedMember[0].is_admin).toBe(true);

    // Verify group3: deleted entirely
    const deletedGroup = await db.select()
      .from(groupsTable)
      .where(eq(groupsTable.id, group3[0].id))
      .execute();
    expect(deletedGroup).toHaveLength(0);
  });

  it('should throw error when admin is inactive', async () => {
    // Deactivate admin user
    await db.update(usersTable)
      .set({ is_active: false })
      .where(eq(usersTable.id, adminId))
      .execute();

    await expect(deleteUser(targetUserId, adminId))
      .rejects.toThrow(/unauthorized.*admin/i);
  });
});