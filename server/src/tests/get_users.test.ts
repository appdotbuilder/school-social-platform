import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { getUsers } from '../handlers/get_users';
import { type CreateUserInput } from '../schema';


// Test user data
const testUser1: CreateUserInput = {
  email: 'john@example.com',
  password: 'password123',
  first_name: 'John',
  last_name: 'Doe',
  role: 'student',
  bio: 'Computer Science student',
  graduation_year: 2024
};

const testUser2: CreateUserInput = {
  email: 'jane@example.com',
  password: 'password456',
  first_name: 'Jane',
  last_name: 'Smith',
  role: 'teacher',
  department: 'Mathematics',
  bio: 'Math teacher'
};

const testUser3: CreateUserInput = {
  email: 'admin@example.com',
  password: 'admin123',
  first_name: 'Admin',
  last_name: 'User',
  role: 'admin'
};

describe('getUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no users exist', async () => {
    const result = await getUsers();
    
    expect(result).toEqual([]);
  });

  it('should return all users when they exist', async () => {
    // Create test users
    await db.insert(usersTable).values([
      {
        email: testUser1.email,
        password_hash: 'hashed_password_1',
        first_name: testUser1.first_name,
        last_name: testUser1.last_name,
        role: testUser1.role,
        bio: testUser1.bio,
        graduation_year: testUser1.graduation_year
      },
      {
        email: testUser2.email,
        password_hash: 'hashed_password_2',
        first_name: testUser2.first_name,
        last_name: testUser2.last_name,
        role: testUser2.role,
        department: testUser2.department,
        bio: testUser2.bio
      }
    ]).execute();

    const result = await getUsers();

    expect(result).toHaveLength(2);
    
    // Verify first user
    const user1 = result.find(u => u.email === testUser1.email);
    expect(user1).toBeDefined();
    expect(user1!.first_name).toEqual('John');
    expect(user1!.last_name).toEqual('Doe');
    expect(user1!.role).toEqual('student');
    expect(user1!.bio).toEqual('Computer Science student');
    expect(user1!.graduation_year).toEqual(2024);
    expect(user1!.department).toBeNull();
    expect(user1!.is_active).toEqual(true);
    expect(user1!.created_at).toBeInstanceOf(Date);
    expect(user1!.updated_at).toBeInstanceOf(Date);

    // Verify second user
    const user2 = result.find(u => u.email === testUser2.email);
    expect(user2).toBeDefined();
    expect(user2!.first_name).toEqual('Jane');
    expect(user2!.last_name).toEqual('Smith');
    expect(user2!.role).toEqual('teacher');
    expect(user2!.department).toEqual('Mathematics');
    expect(user2!.graduation_year).toBeNull();
    expect(user2!.is_active).toEqual(true);
  });

  it('should return users with different roles correctly', async () => {
    // Create users with different roles
    await db.insert(usersTable).values([
      {
        email: testUser1.email,
        password_hash: 'hashed_password',
        first_name: testUser1.first_name,
        last_name: testUser1.last_name,
        role: 'student',
        graduation_year: 2024
      },
      {
        email: testUser2.email,
        password_hash: 'hashed_password',
        first_name: testUser2.first_name,
        last_name: testUser2.last_name,
        role: 'teacher',
        department: 'Mathematics'
      },
      {
        email: testUser3.email,
        password_hash: 'hashed_password',
        first_name: testUser3.first_name,
        last_name: testUser3.last_name,
        role: 'admin'
      }
    ]).execute();

    const result = await getUsers();

    expect(result).toHaveLength(3);
    
    const roles = result.map(user => user.role);
    expect(roles).toContain('student');
    expect(roles).toContain('teacher');
    expect(roles).toContain('admin');
  });

  it('should return users with correct nullable fields', async () => {
    // Create a user with minimal required fields
    await db.insert(usersTable).values({
      email: 'minimal@example.com',
      password_hash: 'hashed_password',
      first_name: 'Min',
      last_name: 'User',
      role: 'alumni'
      // No bio, profile_picture, graduation_year, or department
    }).execute();

    const result = await getUsers();

    expect(result).toHaveLength(1);
    const user = result[0];
    
    expect(user.bio).toBeNull();
    expect(user.profile_picture).toBeNull();
    expect(user.graduation_year).toBeNull();
    expect(user.department).toBeNull();
    expect(user.is_active).toEqual(true); // Default value
  });

  it('should include inactive users in results', async () => {
    // Create both active and inactive users
    await db.insert(usersTable).values([
      {
        email: 'active@example.com',
        password_hash: 'hashed_password',
        first_name: 'Active',
        last_name: 'User',
        role: 'student',
        is_active: true
      },
      {
        email: 'inactive@example.com',
        password_hash: 'hashed_password',
        first_name: 'Inactive',
        last_name: 'User',
        role: 'student',
        is_active: false
      }
    ]).execute();

    const result = await getUsers();

    expect(result).toHaveLength(2);
    
    const activeUser = result.find(u => u.email === 'active@example.com');
    const inactiveUser = result.find(u => u.email === 'inactive@example.com');
    
    expect(activeUser!.is_active).toEqual(true);
    expect(inactiveUser!.is_active).toEqual(false);
  });

  it('should return users with profile pictures and bio', async () => {
    await db.insert(usersTable).values({
      email: 'complete@example.com',
      password_hash: 'hashed_password',
      first_name: 'Complete',
      last_name: 'User',
      role: 'student',
      profile_picture: 'https://example.com/avatar.jpg',
      bio: 'This is my bio',
      graduation_year: 2023
    }).execute();

    const result = await getUsers();

    expect(result).toHaveLength(1);
    const user = result[0];
    
    expect(user.profile_picture).toEqual('https://example.com/avatar.jpg');
    expect(user.bio).toEqual('This is my bio');
    expect(user.graduation_year).toEqual(2023);
  });
});