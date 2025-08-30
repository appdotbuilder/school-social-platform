import { db } from '../db';
import { usersTable, postsTable, commentsTable, groupsTable, groupMembershipsTable, privateMessagesTable } from '../db/schema';
import { eq, and, ne, sql } from 'drizzle-orm';

export async function deleteUser(userId: number, adminId: number): Promise<void> {
  try {
    // Verify admin exists and has admin role
    const adminUser = await db.select()
      .from(usersTable)
      .where(and(eq(usersTable.id, adminId), eq(usersTable.role, 'admin'), eq(usersTable.is_active, true)))
      .execute();

    if (adminUser.length === 0) {
      throw new Error('Unauthorized: Admin user not found or not active');
    }

    // Verify target user exists
    const targetUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (targetUser.length === 0) {
      throw new Error('User not found');
    }

    // Cannot delete another admin user
    if (targetUser[0].role === 'admin') {
      throw new Error('Cannot delete admin users');
    }

    // Start transaction for atomic operations
    await db.transaction(async (tx) => {
      // 1. Deactivate the user account (soft delete)
      await tx.update(usersTable)
        .set({ 
          is_active: false, 
          updated_at: new Date() 
        })
        .where(eq(usersTable.id, userId))
        .execute();

      // 2. Handle group ownership transfers
      // Find groups owned by this user
      const ownedGroups = await tx.select()
        .from(groupsTable)
        .where(eq(groupsTable.owner_id, userId))
        .execute();

      for (const group of ownedGroups) {
        // Try to find another admin member to transfer ownership
        const adminMembers = await tx.select()
          .from(groupMembershipsTable)
          .where(and(
            eq(groupMembershipsTable.group_id, group.id),
            eq(groupMembershipsTable.is_admin, true),
            ne(groupMembershipsTable.user_id, userId)
          ))
          .execute();

        if (adminMembers.length > 0) {
          // Transfer ownership to the first admin member found
          await tx.update(groupsTable)
            .set({ 
              owner_id: adminMembers[0].user_id,
              updated_at: new Date()
            })
            .where(eq(groupsTable.id, group.id))
            .execute();
        } else {
          // No admin members available, find any member to promote and transfer
          const anyMember = await tx.select()
            .from(groupMembershipsTable)
            .where(and(
              eq(groupMembershipsTable.group_id, group.id),
              ne(groupMembershipsTable.user_id, userId)
            ))
            .limit(1)
            .execute();

          if (anyMember.length > 0) {
            // Promote member to admin
            await tx.update(groupMembershipsTable)
              .set({ is_admin: true })
              .where(eq(groupMembershipsTable.id, anyMember[0].id))
              .execute();

            // Transfer ownership
            await tx.update(groupsTable)
              .set({ 
                owner_id: anyMember[0].user_id,
                updated_at: new Date()
              })
              .where(eq(groupsTable.id, group.id))
              .execute();
          } else {
            // No members left, delete the group entirely
            await tx.delete(groupsTable)
              .where(eq(groupsTable.id, group.id))
              .execute();
          }
        }
      }

      // 3. Remove user from group memberships
      await tx.delete(groupMembershipsTable)
        .where(eq(groupMembershipsTable.user_id, userId))
        .execute();

      // 4. Update member counts for groups the user was in
      await tx.execute(sql`
        UPDATE groups 
        SET member_count = (
          SELECT COUNT(*) 
          FROM group_memberships 
          WHERE group_memberships.group_id = groups.id
        ),
        updated_at = NOW()
      `);

      // 5. Delete private messages (both sent and received)
      await tx.delete(privateMessagesTable)
        .where(eq(privateMessagesTable.sender_id, userId))
        .execute();

      await tx.delete(privateMessagesTable)
        .where(eq(privateMessagesTable.recipient_id, userId))
        .execute();

      // 6. Handle posts and comments (keep them but with deactivated author)
      // Update posts to reflect the deactivated state
      await tx.update(postsTable)
        .set({ updated_at: new Date() })
        .where(eq(postsTable.author_id, userId))
        .execute();

      // Update comments to reflect the deactivated state  
      await tx.update(commentsTable)
        .set({ updated_at: new Date() })
        .where(eq(commentsTable.author_id, userId))
        .execute();

      // Note: We keep posts and comments for historical/content integrity reasons
      // The posts/comments will show as from a deactivated user when displayed
    });

  } catch (error) {
    console.error('User deletion failed:', error);
    throw error;
  }
}