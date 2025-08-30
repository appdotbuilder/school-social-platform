import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';

// Test input with all fields
const testInput: CreateUserInput = {
  email: 'test@example.com',
  password: 'password123',
  first_name: 'John',
  last_name: 'Doe',
  role: 'student',
  profile_picture: 'https://example.com/profile.jpg',
  bio: 'Test bio',
  graduation_year: 2024,
  department: null
};

// Minimal test input
const minimalInput: CreateUserInput = {
  email: 'minimal@example.com',
  password: 'password123',
  first_name: 'Jane',
  last_name: 'Smith',
  role: 'teacher'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with all fields', async () => {
    const result = await createUser(testInput);

    // Basic field validation
    expect(result.email).toEqual('test@example.com');
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
    expect(result.role).toEqual('student');
    expect(result.profile_picture).toEqual('https://example.com/profile.jpg');
    expect(result.bio).toEqual('Test bio');
    expect(result.graduation_year).toEqual(2024);
    expect(result.department).toBeNull();
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Password should be hashed, not plain text
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual('password123');
    expect(result.password_hash.length).toBeGreaterThan(10);
  });

  it('should create a user with minimal required fields', async () => {
    const result = await createUser(minimalInput);

    expect(result.email).toEqual('minimal@example.com');
    expect(result.first_name).toEqual('Jane');
    expect(result.last_name).toEqual('Smith');
    expect(result.role).toEqual('teacher');
    expect(result.profile_picture).toBeNull();
    expect(result.bio).toBeNull();
    expect(result.graduation_year).toBeNull();
    expect(result.department).toBeNull();
    expect(result.is_active).toBe(true);
  });

  it('should save user to database', async () => {
    const result = await createUser(testInput);

    // Query from database to verify persistence
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].first_name).toEqual('John');
    expect(users[0].last_name).toEqual('Doe');
    expect(users[0].role).toEqual('student');
    expect(users[0].graduation_year).toEqual(2024);
    expect(users[0].is_active).toBe(true);
    expect(users[0].created_at).toBeInstanceOf(Date);
  });

  it('should hash password correctly', async () => {
    const result = await createUser(testInput);

    // Verify password was hashed
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual('password123');
    
    // Verify hashed password can be verified
    const isValid = await Bun.password.verify('password123', result.password_hash);
    expect(isValid).toBe(true);

    // Verify incorrect password fails
    const isInvalid = await Bun.password.verify('wrongpassword', result.password_hash);
    expect(isInvalid).toBe(false);
  });

  it('should handle different user roles', async () => {
    const roles = ['admin', 'student', 'teacher', 'alumni'] as const;
    
    for (const role of roles) {
      const input: CreateUserInput = {
        email: `${role}@example.com`,
        password: 'password123',
        first_name: 'Test',
        last_name: 'User',
        role: role
      };
      
      const result = await createUser(input);
      expect(result.role).toEqual(role);
    }
  });

  it('should reject duplicate email addresses', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create user with same email
    await expect(createUser(testInput)).rejects.toThrow(/duplicate key value/i);
  });

  it('should handle teacher with department', async () => {
    const teacherInput: CreateUserInput = {
      email: 'teacher@example.com',
      password: 'password123',
      first_name: 'Professor',
      last_name: 'Smith',
      role: 'teacher',
      department: 'Computer Science'
    };

    const result = await createUser(teacherInput);
    expect(result.role).toEqual('teacher');
    expect(result.department).toEqual('Computer Science');
    expect(result.graduation_year).toBeNull();
  });

  it('should handle student with graduation year', async () => {
    const studentInput: CreateUserInput = {
      email: 'student@example.com',
      password: 'password123',
      first_name: 'Student',
      last_name: 'Johnson',
      role: 'student',
      graduation_year: 2025
    };

    const result = await createUser(studentInput);
    expect(result.role).toEqual('student');
    expect(result.graduation_year).toEqual(2025);
    expect(result.department).toBeNull();
  });
});