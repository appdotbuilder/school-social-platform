import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, groupsTable, groupMembershipsTable } from '../db/schema';
import { type JoinGroupInput } from '../schema';
import { joinGroup, leaveGroup } from '../handlers/join_group';
import { eq, and } from 'drizzle-orm';

describe('joinGroup and leaveGroup handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test users
  const createTestUser = async (email: string, role = 'student' as const) => {
    const result = await db.insert(usersTable)
      .values({
        email,
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role
      })
      .returning()
      .execute();
    return result[0];
  };

  // Helper function to create test group
  const createTestGroup = async (ownerId: number, isPrivate = false) => {
    const result = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'A test group',
        owner_id: ownerId,
        is_private: isPrivate,
        member_count: 1
      })
      .returning()
      .execute();

    // Create owner's membership
    await db.insert(groupMembershipsTable)
      .values({
        group_id: result[0].id,
        user_id: ownerId,
        is_admin: true
      })
      .execute();

    return result[0];
  };

  describe('joinGroup', () => {
    it('should allow user to join a group', async () => {
      const owner = await createTestUser('owner@test.com');
      const user = await createTestUser('user@test.com');
      const group = await createTestGroup(owner.id);

      const input: JoinGroupInput = {
        group_id: group.id
      };

      const result = await joinGroup(input, user.id);

      // Verify membership created
      expect(result.group_id).toEqual(group.id);
      expect(result.user_id).toEqual(user.id);
      expect(result.is_admin).toBe(false);
      expect(result.id).toBeDefined();
      expect(result.joined_at).toBeInstanceOf(Date);
    });

    it('should increment group member count', async () => {
      const owner = await createTestUser('owner@test.com');
      const user = await createTestUser('user@test.com');
      const group = await createTestGroup(owner.id);

      const input: JoinGroupInput = {
        group_id: group.id
      };

      await joinGroup(input, user.id);

      // Check that member count was incremented
      const updatedGroup = await db.select()
        .from(groupsTable)
        .where(eq(groupsTable.id, group.id))
        .execute();

      expect(updatedGroup[0].member_count).toEqual(2); // Owner + new member
    });

    it('should create membership record in database', async () => {
      const owner = await createTestUser('owner@test.com');
      const user = await createTestUser('user@test.com');
      const group = await createTestGroup(owner.id);

      const input: JoinGroupInput = {
        group_id: group.id
      };

      const result = await joinGroup(input, user.id);

      // Verify membership exists in database
      const memberships = await db.select()
        .from(groupMembershipsTable)
        .where(and(
          eq(groupMembershipsTable.group_id, group.id),
          eq(groupMembershipsTable.user_id, user.id)
        ))
        .execute();

      expect(memberships).toHaveLength(1);
      expect(memberships[0].id).toEqual(result.id);
      expect(memberships[0].is_admin).toBe(false);
    });

    it('should throw error if user does not exist', async () => {
      const owner = await createTestUser('owner@test.com');
      const group = await createTestGroup(owner.id);
      const nonExistentUserId = 999;

      const input: JoinGroupInput = {
        group_id: group.id
      };

      await expect(joinGroup(input, nonExistentUserId)).rejects.toThrow(/user not found/i);
    });

    it('should throw error if group does not exist', async () => {
      const user = await createTestUser('user@test.com');
      const nonExistentGroupId = 999;

      const input: JoinGroupInput = {
        group_id: nonExistentGroupId
      };

      await expect(joinGroup(input, user.id)).rejects.toThrow(/group not found/i);
    });

    it('should throw error if user is already a member', async () => {
      const owner = await createTestUser('owner@test.com');
      const user = await createTestUser('user@test.com');
      const group = await createTestGroup(owner.id);

      const input: JoinGroupInput = {
        group_id: group.id
      };

      // Join once
      await joinGroup(input, user.id);

      // Try to join again
      await expect(joinGroup(input, user.id)).rejects.toThrow(/already a member/i);
    });
  });

  describe('leaveGroup', () => {
    it('should allow user to leave a group', async () => {
      const owner = await createTestUser('owner@test.com');
      const user = await createTestUser('user@test.com');
      const group = await createTestGroup(owner.id);

      // First join the group
      const input: JoinGroupInput = {
        group_id: group.id
      };
      await joinGroup(input, user.id);

      // Then leave
      await leaveGroup(group.id, user.id);

      // Verify membership is removed
      const memberships = await db.select()
        .from(groupMembershipsTable)
        .where(and(
          eq(groupMembershipsTable.group_id, group.id),
          eq(groupMembershipsTable.user_id, user.id)
        ))
        .execute();

      expect(memberships).toHaveLength(0);
    });

    it('should decrement group member count', async () => {
      const owner = await createTestUser('owner@test.com');
      const user = await createTestUser('user@test.com');
      const group = await createTestGroup(owner.id);

      // Join first
      const input: JoinGroupInput = {
        group_id: group.id
      };
      await joinGroup(input, user.id);

      // Verify member count is 2
      let updatedGroup = await db.select()
        .from(groupsTable)
        .where(eq(groupsTable.id, group.id))
        .execute();
      expect(updatedGroup[0].member_count).toEqual(2);

      // Leave group
      await leaveGroup(group.id, user.id);

      // Check that member count was decremented
      updatedGroup = await db.select()
        .from(groupsTable)
        .where(eq(groupsTable.id, group.id))
        .execute();

      expect(updatedGroup[0].member_count).toEqual(1); // Back to just owner
    });

    it('should throw error if user does not exist', async () => {
      const owner = await createTestUser('owner@test.com');
      const group = await createTestGroup(owner.id);
      const nonExistentUserId = 999;

      await expect(leaveGroup(group.id, nonExistentUserId)).rejects.toThrow(/user not found/i);
    });

    it('should throw error if group does not exist', async () => {
      const user = await createTestUser('user@test.com');
      const nonExistentGroupId = 999;

      await expect(leaveGroup(nonExistentGroupId, user.id)).rejects.toThrow(/group not found/i);
    });

    it('should throw error if user is not a member', async () => {
      const owner = await createTestUser('owner@test.com');
      const user = await createTestUser('user@test.com');
      const group = await createTestGroup(owner.id);

      await expect(leaveGroup(group.id, user.id)).rejects.toThrow(/not a member/i);
    });

    it('should transfer ownership to another admin when owner leaves', async () => {
      const owner = await createTestUser('owner@test.com');
      const admin = await createTestUser('admin@test.com');
      const user = await createTestUser('user@test.com');
      const group = await createTestGroup(owner.id);

      // Add admin user to group and make them admin
      const joinInput: JoinGroupInput = { group_id: group.id };
      await joinGroup(joinInput, admin.id);
      await joinGroup(joinInput, user.id);

      // Make admin user an admin
      await db.update(groupMembershipsTable)
        .set({ is_admin: true })
        .where(and(
          eq(groupMembershipsTable.group_id, group.id),
          eq(groupMembershipsTable.user_id, admin.id)
        ))
        .execute();

      // Owner leaves
      await leaveGroup(group.id, owner.id);

      // Verify ownership transferred to admin
      const updatedGroup = await db.select()
        .from(groupsTable)
        .where(eq(groupsTable.id, group.id))
        .execute();

      expect(updatedGroup[0].owner_id).toEqual(admin.id);
    });

    it('should transfer ownership to regular member if no admins exist', async () => {
      const owner = await createTestUser('owner@test.com');
      const user = await createTestUser('user@test.com');
      const group = await createTestGroup(owner.id);

      // Add regular user to group
      const joinInput: JoinGroupInput = { group_id: group.id };
      await joinGroup(joinInput, user.id);

      // Owner leaves
      await leaveGroup(group.id, owner.id);

      // Verify ownership transferred to regular user and they became admin
      const updatedGroup = await db.select()
        .from(groupsTable)
        .where(eq(groupsTable.id, group.id))
        .execute();

      const newOwnerMembership = await db.select()
        .from(groupMembershipsTable)
        .where(and(
          eq(groupMembershipsTable.group_id, group.id),
          eq(groupMembershipsTable.user_id, user.id)
        ))
        .execute();

      expect(updatedGroup[0].owner_id).toEqual(user.id);
      expect(newOwnerMembership[0].is_admin).toBe(true);
    });

    it('should handle owner leaving when no other members exist', async () => {
      const owner = await createTestUser('owner@test.com');
      const group = await createTestGroup(owner.id);

      // Owner leaves (no other members)
      await leaveGroup(group.id, owner.id);

      // Group should still exist but with no owner membership
      const updatedGroup = await db.select()
        .from(groupsTable)
        .where(eq(groupsTable.id, group.id))
        .execute();

      const memberships = await db.select()
        .from(groupMembershipsTable)
        .where(eq(groupMembershipsTable.group_id, group.id))
        .execute();

      expect(updatedGroup[0].member_count).toEqual(0);
      expect(memberships).toHaveLength(0);
    });
  });
});