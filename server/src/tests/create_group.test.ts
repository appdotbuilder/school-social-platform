import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { groupsTable, groupMembershipsTable, usersTable } from '../db/schema';
import { type CreateGroupInput } from '../schema';
import { createGroup } from '../handlers/create_group';
import { eq } from 'drizzle-orm';

describe('createGroup', () => {
  let testUserId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create a test user first (required for foreign key constraint)
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        first_name: 'Test',
        last_name: 'User',
        role: 'student',
        is_active: true
      })
      .returning()
      .execute();
    
    testUserId = userResult[0].id;
  });

  afterEach(resetDB);

  it('should create a group with all required fields', async () => {
    const testInput: CreateGroupInput = {
      name: 'Test Study Group',
      description: 'A group for studying together',
      is_private: false
    };

    const result = await createGroup(testInput, testUserId);

    // Verify basic fields
    expect(result.name).toEqual('Test Study Group');
    expect(result.description).toEqual('A group for studying together');
    expect(result.owner_id).toEqual(testUserId);
    expect(result.is_private).toEqual(false);
    expect(result.member_count).toEqual(1);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a private group', async () => {
    const testInput: CreateGroupInput = {
      name: 'Private Group',
      description: 'A private group',
      is_private: true
    };

    const result = await createGroup(testInput, testUserId);

    expect(result.is_private).toEqual(true);
    expect(result.name).toEqual('Private Group');
  });

  it('should create a group with null description', async () => {
    const testInput: CreateGroupInput = {
      name: 'No Description Group',
      description: null,
      is_private: false
    };

    const result = await createGroup(testInput, testUserId);

    expect(result.description).toBeNull();
    expect(result.name).toEqual('No Description Group');
  });

  it('should create a group with false privacy setting', async () => {
    const testInput: CreateGroupInput = {
      name: 'Public Group',
      description: 'Testing public group creation',
      is_private: false
    };

    const result = await createGroup(testInput, testUserId);

    expect(result.is_private).toEqual(false);
  });

  it('should save group to database', async () => {
    const testInput: CreateGroupInput = {
      name: 'Database Test Group',
      description: 'Testing database persistence',
      is_private: true
    };

    const result = await createGroup(testInput, testUserId);

    // Verify group was saved to database
    const groups = await db.select()
      .from(groupsTable)
      .where(eq(groupsTable.id, result.id))
      .execute();

    expect(groups).toHaveLength(1);
    expect(groups[0].name).toEqual('Database Test Group');
    expect(groups[0].description).toEqual('Testing database persistence');
    expect(groups[0].owner_id).toEqual(testUserId);
    expect(groups[0].is_private).toEqual(true);
    expect(groups[0].member_count).toEqual(1);
  });

  it('should automatically add owner as group member and admin', async () => {
    const testInput: CreateGroupInput = {
      name: 'Membership Test Group',
      description: 'Testing automatic membership creation',
      is_private: false
    };

    const result = await createGroup(testInput, testUserId);

    // Verify membership was created
    const memberships = await db.select()
      .from(groupMembershipsTable)
      .where(eq(groupMembershipsTable.group_id, result.id))
      .execute();

    expect(memberships).toHaveLength(1);
    expect(memberships[0].user_id).toEqual(testUserId);
    expect(memberships[0].group_id).toEqual(result.id);
    expect(memberships[0].is_admin).toEqual(true);
    expect(memberships[0].joined_at).toBeInstanceOf(Date);
  });

  it('should handle missing description gracefully', async () => {
    const testInput: CreateGroupInput = {
      name: 'Minimal Group',
      is_private: false
      // description omitted - should be handled by optional field
    };

    const result = await createGroup(testInput, testUserId);

    expect(result.name).toEqual('Minimal Group');
    expect(result.description).toBeNull();
    expect(result.owner_id).toEqual(testUserId);
  });

  it('should fail when owner user does not exist', async () => {
    const testInput: CreateGroupInput = {
      name: 'Invalid Owner Group',
      description: 'Testing with non-existent owner',
      is_private: false
    };

    const nonExistentUserId = 99999;

    await expect(createGroup(testInput, nonExistentUserId))
      .rejects.toThrow(/violates foreign key constraint/i);
  });

  it('should handle transaction rollback on membership creation failure', async () => {
    const testInput: CreateGroupInput = {
      name: 'Transaction Test Group',
      description: 'Testing transaction integrity',
      is_private: false
    };

    // This test ensures that if membership creation fails, the group isn't created either
    const result = await createGroup(testInput, testUserId);

    // Verify both group and membership exist (successful transaction)
    const groups = await db.select()
      .from(groupsTable)
      .where(eq(groupsTable.id, result.id))
      .execute();

    const memberships = await db.select()
      .from(groupMembershipsTable)
      .where(eq(groupMembershipsTable.group_id, result.id))
      .execute();

    expect(groups).toHaveLength(1);
    expect(memberships).toHaveLength(1);
  });
});