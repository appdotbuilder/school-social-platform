import { db } from '../db';
import { groupsTable, groupMembershipsTable, usersTable } from '../db/schema';
import { type JoinGroupInput, type GroupMembership } from '../schema';
import { eq, and, sql } from 'drizzle-orm';

export async function joinGroup(input: JoinGroupInput, userId: number): Promise<GroupMembership> {
  try {
    // First, verify the user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Verify the group exists and get its details
    const group = await db.select()
      .from(groupsTable)
      .where(eq(groupsTable.id, input.group_id))
      .execute();

    if (group.length === 0) {
      throw new Error('Group not found');
    }

    // Check if user is already a member
    const existingMembership = await db.select()
      .from(groupMembershipsTable)
      .where(and(
        eq(groupMembershipsTable.group_id, input.group_id),
        eq(groupMembershipsTable.user_id, userId)
      ))
      .execute();

    if (existingMembership.length > 0) {
      throw new Error('User is already a member of this group');
    }

    // For private groups, we could add additional checks here
    // For now, assuming all groups allow joining (or proper auth is handled elsewhere)

    // Create the membership record
    const membershipResult = await db.insert(groupMembershipsTable)
      .values({
        group_id: input.group_id,
        user_id: userId,
        is_admin: false
      })
      .returning()
      .execute();

    // Increment the group's member count
    await db.update(groupsTable)
      .set({
        member_count: sql`${groupsTable.member_count} + 1`,
        updated_at: new Date()
      })
      .where(eq(groupsTable.id, input.group_id))
      .execute();

    return membershipResult[0];
  } catch (error) {
    console.error('Join group failed:', error);
    throw error;
  }
}

export async function leaveGroup(groupId: number, userId: number): Promise<void> {
  try {
    // Verify the user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Verify the group exists and get its details
    const group = await db.select()
      .from(groupsTable)
      .where(eq(groupsTable.id, groupId))
      .execute();

    if (group.length === 0) {
      throw new Error('Group not found');
    }

    // Check if user is a member
    const membership = await db.select()
      .from(groupMembershipsTable)
      .where(and(
        eq(groupMembershipsTable.group_id, groupId),
        eq(groupMembershipsTable.user_id, userId)
      ))
      .execute();

    if (membership.length === 0) {
      throw new Error('User is not a member of this group');
    }

    // Check if user is the owner
    const isOwner = group[0].owner_id === userId;

    if (isOwner) {
      // If owner is leaving, we need to handle ownership transfer
      // Find another admin to transfer ownership to
      const otherAdmins = await db.select()
        .from(groupMembershipsTable)
        .where(and(
          eq(groupMembershipsTable.group_id, groupId),
          eq(groupMembershipsTable.is_admin, true),
          sql`${groupMembershipsTable.user_id} != ${userId}`
        ))
        .execute();

      if (otherAdmins.length > 0) {
        // Transfer ownership to the first admin found
        await db.update(groupsTable)
          .set({
            owner_id: otherAdmins[0].user_id,
            updated_at: new Date()
          })
          .where(eq(groupsTable.id, groupId))
          .execute();
      } else {
        // No other admins, find any other member to transfer ownership
        const otherMembers = await db.select()
          .from(groupMembershipsTable)
          .where(and(
            eq(groupMembershipsTable.group_id, groupId),
            sql`${groupMembershipsTable.user_id} != ${userId}`
          ))
          .limit(1)
          .execute();

        if (otherMembers.length > 0) {
          // Transfer ownership and make them admin
          await db.update(groupsTable)
            .set({
              owner_id: otherMembers[0].user_id,
              updated_at: new Date()
            })
            .where(eq(groupsTable.id, groupId))
            .execute();

          // Make the new owner an admin
          await db.update(groupMembershipsTable)
            .set({
              is_admin: true
            })
            .where(eq(groupMembershipsTable.id, otherMembers[0].id))
            .execute();
        }
        // If no other members exist, the group will effectively become ownerless
        // This could be handled by deleting the group, but we'll leave it for now
      }
    }

    // Remove the membership
    await db.delete(groupMembershipsTable)
      .where(and(
        eq(groupMembershipsTable.group_id, groupId),
        eq(groupMembershipsTable.user_id, userId)
      ))
      .execute();

    // Decrement the group's member count
    await db.update(groupsTable)
      .set({
        member_count: sql`${groupsTable.member_count} - 1`,
        updated_at: new Date()
      })
      .where(eq(groupsTable.id, groupId))
      .execute();

  } catch (error) {
    console.error('Leave group failed:', error);
    throw error;
  }
}