import { db } from '../db';
import { groupsTable, groupMembershipsTable } from '../db/schema';
import { type Group } from '../schema';
import { eq } from 'drizzle-orm';

export async function getUserGroups(userId: number): Promise<Group[]> {
  try {
    // Query groups where user is a member
    const results = await db.select()
      .from(groupsTable)
      .innerJoin(
        groupMembershipsTable,
        eq(groupsTable.id, groupMembershipsTable.group_id)
      )
      .where(eq(groupMembershipsTable.user_id, userId))
      .execute();

    // Return the group data from the joined results
    return results.map(result => result.groups);
  } catch (error) {
    console.error('Failed to get user groups:', error);
    throw error;
  }
}