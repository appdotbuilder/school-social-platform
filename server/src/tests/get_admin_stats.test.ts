import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable, groupsTable } from '../db/schema';
import { getAdminStats } from '../handlers/get_admin_stats';

describe('getAdminStats', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return zero stats for empty database', async () => {
    const stats = await getAdminStats();

    expect(stats.total_users).toEqual(0);
    expect(stats.total_posts).toEqual(0);
    expect(stats.total_groups).toEqual(0);
    expect(stats.active_users_today).toEqual(0);
    expect(stats.users_by_role.admin).toEqual(0);
    expect(stats.users_by_role.student).toEqual(0);
    expect(stats.users_by_role.teacher).toEqual(0);
    expect(stats.users_by_role.alumni).toEqual(0);
  });

  it('should count users by role correctly', async () => {
    // Create users with different roles
    await db.insert(usersTable).values([
      {
        email: 'admin@test.com',
        password_hash: 'hash1',
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin'
      },
      {
        email: 'student1@test.com',
        password_hash: 'hash2',
        first_name: 'Student',
        last_name: 'One',
        role: 'student',
        graduation_year: 2024
      },
      {
        email: 'student2@test.com',
        password_hash: 'hash3',
        first_name: 'Student',
        last_name: 'Two',
        role: 'student',
        graduation_year: 2023
      },
      {
        email: 'teacher@test.com',
        password_hash: 'hash4',
        first_name: 'Teacher',
        last_name: 'User',
        role: 'teacher',
        department: 'Computer Science'
      },
      {
        email: 'alumni@test.com',
        password_hash: 'hash5',
        first_name: 'Alumni',
        last_name: 'User',
        role: 'alumni',
        graduation_year: 2020
      }
    ]).execute();

    const stats = await getAdminStats();

    expect(stats.total_users).toEqual(5);
    expect(stats.users_by_role.admin).toEqual(1);
    expect(stats.users_by_role.student).toEqual(2);
    expect(stats.users_by_role.teacher).toEqual(1);
    expect(stats.users_by_role.alumni).toEqual(1);
  });

  it('should count posts correctly', async () => {
    // Create a user first
    const [user] = await db.insert(usersTable).values({
      email: 'user@test.com',
      password_hash: 'hash',
      first_name: 'Test',
      last_name: 'User',
      role: 'student'
    }).returning().execute();

    // Create posts
    await db.insert(postsTable).values([
      {
        author_id: user.id,
        content: 'First post'
      },
      {
        author_id: user.id,
        content: 'Second post'
      },
      {
        author_id: user.id,
        content: 'Third post'
      }
    ]).execute();

    const stats = await getAdminStats();

    expect(stats.total_posts).toEqual(3);
  });

  it('should count groups correctly', async () => {
    // Create a user first to be the owner
    const [user] = await db.insert(usersTable).values({
      email: 'owner@test.com',
      password_hash: 'hash',
      first_name: 'Group',
      last_name: 'Owner',
      role: 'teacher'
    }).returning().execute();

    // Create groups
    await db.insert(groupsTable).values([
      {
        name: 'Study Group 1',
        description: 'First study group',
        owner_id: user.id
      },
      {
        name: 'Study Group 2',
        owner_id: user.id,
        is_private: true
      }
    ]).execute();

    const stats = await getAdminStats();

    expect(stats.total_groups).toEqual(2);
  });

  it('should count active users today correctly', async () => {
    // Create users
    const users = await db.insert(usersTable).values([
      {
        email: 'active1@test.com',
        password_hash: 'hash1',
        first_name: 'Active',
        last_name: 'One',
        role: 'student'
      },
      {
        email: 'active2@test.com',
        password_hash: 'hash2',
        first_name: 'Active',
        last_name: 'Two',
        role: 'teacher'
      },
      {
        email: 'inactive@test.com',
        password_hash: 'hash3',
        first_name: 'Inactive',
        last_name: 'User',
        role: 'alumni'
      }
    ]).returning().execute();

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Create posts - some today, some yesterday
    await db.insert(postsTable).values([
      {
        author_id: users[0].id,
        content: 'Post from today',
        created_at: today
      },
      {
        author_id: users[1].id,
        content: 'Another post from today',
        created_at: today
      },
      {
        author_id: users[0].id,
        content: 'Another post from same user today',
        created_at: today
      },
      {
        author_id: users[2].id,
        content: 'Post from yesterday',
        created_at: yesterday
      }
    ]).execute();

    const stats = await getAdminStats();

    // Only 2 unique users posted today (users[0] and users[1])
    expect(stats.active_users_today).toEqual(2);
  });

  it('should return comprehensive stats with all data', async () => {
    // Create users with different roles
    const users = await db.insert(usersTable).values([
      {
        email: 'admin@test.com',
        password_hash: 'hash1',
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin'
      },
      {
        email: 'student@test.com',
        password_hash: 'hash2',
        first_name: 'Student',
        last_name: 'User',
        role: 'student',
        graduation_year: 2024
      },
      {
        email: 'teacher@test.com',
        password_hash: 'hash3',
        first_name: 'Teacher',
        last_name: 'User',
        role: 'teacher',
        department: 'Mathematics'
      }
    ]).returning().execute();

    // Create posts
    await db.insert(postsTable).values([
      {
        author_id: users[1].id, // student
        content: 'Student post today'
      },
      {
        author_id: users[2].id, // teacher
        content: 'Teacher post today'
      }
    ]).execute();

    // Create groups
    await db.insert(groupsTable).values([
      {
        name: 'Math Study Group',
        owner_id: users[2].id // teacher
      }
    ]).execute();

    const stats = await getAdminStats();

    expect(stats.total_users).toEqual(3);
    expect(stats.total_posts).toEqual(2);
    expect(stats.total_groups).toEqual(1);
    expect(stats.active_users_today).toEqual(2); // student and teacher posted today
    expect(stats.users_by_role.admin).toEqual(1);
    expect(stats.users_by_role.student).toEqual(1);
    expect(stats.users_by_role.teacher).toEqual(1);
    expect(stats.users_by_role.alumni).toEqual(0);
  });

  it('should handle users with no posts for active count', async () => {
    // Create users but no posts
    await db.insert(usersTable).values([
      {
        email: 'user1@test.com',
        password_hash: 'hash1',
        first_name: 'User',
        last_name: 'One',
        role: 'student'
      },
      {
        email: 'user2@test.com',
        password_hash: 'hash2',
        first_name: 'User',
        last_name: 'Two',
        role: 'teacher'
      }
    ]).execute();

    const stats = await getAdminStats();

    expect(stats.total_users).toEqual(2);
    expect(stats.total_posts).toEqual(0);
    expect(stats.active_users_today).toEqual(0); // No posts means no active users
  });
});