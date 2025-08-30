import { db } from '../db';
import { usersTable, postsTable, groupsTable } from '../db/schema';
import { type AdminStats } from '../schema';
import { count, eq, gte, sql } from 'drizzle-orm';

export async function getAdminStats(): Promise<AdminStats> {
  try {
    // Get total counts for users, posts, and groups
    const [totalUsersResult] = await db.select({ count: count() }).from(usersTable).execute();
    const [totalPostsResult] = await db.select({ count: count() }).from(postsTable).execute();
    const [totalGroupsResult] = await db.select({ count: count() }).from(groupsTable).execute();

    // Get users by role counts
    const usersByRoleResult = await db.select({
      role: usersTable.role,
      count: count()
    })
    .from(usersTable)
    .groupBy(usersTable.role)
    .execute();

    // Get active users today (users who created posts today)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    const [activeUsersTodayResult] = await db
      .select({ count: sql<string>`COUNT(DISTINCT ${postsTable.author_id})` })
      .from(postsTable)
      .where(gte(postsTable.created_at, today))
      .execute();

    // Transform users by role data into the required format
    const usersByRole = {
      admin: 0,
      student: 0,
      teacher: 0,
      alumni: 0
    };

    usersByRoleResult.forEach(result => {
      usersByRole[result.role] = result.count;
    });

    return {
      total_users: totalUsersResult.count,
      total_posts: totalPostsResult.count,
      total_groups: totalGroupsResult.count,
      active_users_today: parseInt(activeUsersTodayResult.count) || 0,
      users_by_role: usersByRole
    };
  } catch (error) {
    console.error('Admin stats retrieval failed:', error);
    throw error;
  }
}