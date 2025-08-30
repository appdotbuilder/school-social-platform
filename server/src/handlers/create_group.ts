import { db } from '../db';
import { groupsTable, groupMembershipsTable } from '../db/schema';
import { type CreateGroupInput, type Group } from '../schema';

export async function createGroup(input: CreateGroupInput, ownerId: number): Promise<Group> {
  try {
    // Start a transaction to ensure both group and membership are created together
    const result = await db.transaction(async (tx) => {
      // Insert the group
      const groupResult = await tx.insert(groupsTable)
        .values({
          name: input.name,
          description: input.description || null,
          owner_id: ownerId,
          is_private: input.is_private,
          member_count: 1 // Owner is first member
        })
        .returning()
        .execute();

      const group = groupResult[0];

      // Add the owner as the first member and admin
      await tx.insert(groupMembershipsTable)
        .values({
          group_id: group.id,
          user_id: ownerId,
          is_admin: true
        })
        .execute();

      return group;
    });

    return result;
  } catch (error) {
    console.error('Group creation failed:', error);
    throw error;
  }
}