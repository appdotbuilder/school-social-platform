import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, groupsTable, groupMembershipsTable } from '../db/schema';
import { getUserGroups } from '../handlers/get_user_groups';


describe('getUserGroups', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return groups where user is a member', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'student'
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create test group owner
    const ownerResult = await db.insert(usersTable)
      .values({
        email: 'owner@example.com',
        password_hash: 'hashed_password',
        first_name: 'Owner',
        last_name: 'User',
        role: 'teacher'
      })
      .returning()
      .execute();
    const ownerId = ownerResult[0].id;

    // Create test groups
    const groupsResult = await db.insert(groupsTable)
      .values([
        {
          name: 'Study Group',
          description: 'A group for studying',
          owner_id: ownerId,
          is_private: false
        },
        {
          name: 'Private Club',
          description: 'A private club',
          owner_id: ownerId,
          is_private: true
        }
      ])
      .returning()
      .execute();

    // Add user as member to first group
    await db.insert(groupMembershipsTable)
      .values({
        group_id: groupsResult[0].id,
        user_id: userId,
        is_admin: false
      })
      .execute();

    // Add user as admin to second group
    await db.insert(groupMembershipsTable)
      .values({
        group_id: groupsResult[1].id,
        user_id: userId,
        is_admin: true
      })
      .execute();

    const result = await getUserGroups(userId);

    expect(result).toHaveLength(2);
    
    // Verify group data
    const studyGroup = result.find(g => g.name === 'Study Group');
    const privateClub = result.find(g => g.name === 'Private Club');
    
    expect(studyGroup).toBeDefined();
    expect(studyGroup!.description).toEqual('A group for studying');
    expect(studyGroup!.owner_id).toEqual(ownerId);
    expect(studyGroup!.is_private).toBe(false);
    expect(studyGroup!.member_count).toEqual(1);
    
    expect(privateClub).toBeDefined();
    expect(privateClub!.description).toEqual('A private club');
    expect(privateClub!.owner_id).toEqual(ownerId);
    expect(privateClub!.is_private).toBe(true);
    expect(privateClub!.member_count).toEqual(1);
  });

  it('should return empty array when user is not member of any groups', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'student'
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create another user and group (user is not a member)
    const ownerResult = await db.insert(usersTable)
      .values({
        email: 'owner@example.com',
        password_hash: 'hashed_password',
        first_name: 'Owner',
        last_name: 'User',
        role: 'teacher'
      })
      .returning()
      .execute();

    await db.insert(groupsTable)
      .values({
        name: 'Other Group',
        description: 'A group for others',
        owner_id: ownerResult[0].id,
        is_private: false
      })
      .execute();

    const result = await getUserGroups(userId);

    expect(result).toHaveLength(0);
  });

  it('should include groups user owns', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'owner@example.com',
        password_hash: 'hashed_password',
        first_name: 'Owner',
        last_name: 'User',
        role: 'teacher'
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create group owned by user
    const groupResult = await db.insert(groupsTable)
      .values({
        name: 'My Group',
        description: 'A group I own',
        owner_id: userId,
        is_private: false
      })
      .returning()
      .execute();

    // Add owner as member (should happen automatically in real app)
    await db.insert(groupMembershipsTable)
      .values({
        group_id: groupResult[0].id,
        user_id: userId,
        is_admin: true
      })
      .execute();

    const result = await getUserGroups(userId);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('My Group');
    expect(result[0].owner_id).toEqual(userId);
    expect(result[0].description).toEqual('A group I own');
  });

  it('should handle user with multiple group memberships', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'member@example.com',
        password_hash: 'hashed_password',
        first_name: 'Member',
        last_name: 'User',
        role: 'student'
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create group owners
    const owner1Result = await db.insert(usersTable)
      .values({
        email: 'owner1@example.com',
        password_hash: 'hashed_password',
        first_name: 'Owner1',
        last_name: 'User',
        role: 'teacher'
      })
      .returning()
      .execute();

    const owner2Result = await db.insert(usersTable)
      .values({
        email: 'owner2@example.com',
        password_hash: 'hashed_password',
        first_name: 'Owner2',
        last_name: 'User',
        role: 'alumni'
      })
      .returning()
      .execute();

    // Create multiple groups
    const groupsResult = await db.insert(groupsTable)
      .values([
        {
          name: 'Group A',
          description: 'First group',
          owner_id: owner1Result[0].id,
          is_private: false
        },
        {
          name: 'Group B',
          description: 'Second group',
          owner_id: owner1Result[0].id,
          is_private: true
        },
        {
          name: 'Group C',
          description: 'Third group',
          owner_id: owner2Result[0].id,
          is_private: false
        }
      ])
      .returning()
      .execute();

    // Add user to all groups with different roles
    await db.insert(groupMembershipsTable)
      .values([
        {
          group_id: groupsResult[0].id,
          user_id: userId,
          is_admin: false
        },
        {
          group_id: groupsResult[1].id,
          user_id: userId,
          is_admin: true
        },
        {
          group_id: groupsResult[2].id,
          user_id: userId,
          is_admin: false
        }
      ])
      .execute();

    const result = await getUserGroups(userId);

    expect(result).toHaveLength(3);
    
    const groupNames = result.map(g => g.name).sort();
    expect(groupNames).toEqual(['Group A', 'Group B', 'Group C']);
    
    // Verify each group has correct properties
    result.forEach(group => {
      expect(group.id).toBeDefined();
      expect(group.name).toBeDefined();
      expect(group.owner_id).toBeDefined();
      expect(typeof group.is_private).toBe('boolean');
      expect(group.member_count).toEqual(1);
      expect(group.created_at).toBeInstanceOf(Date);
      expect(group.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should handle non-existent user gracefully', async () => {
    const nonExistentUserId = 99999;
    
    const result = await getUserGroups(nonExistentUserId);
    
    expect(result).toHaveLength(0);
  });
});