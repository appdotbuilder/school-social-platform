import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type UpdateUserInput } from '../schema';
import { updateUser } from '../handlers/update_user';
import { eq } from 'drizzle-orm';
// Helper function to create a test user
const createTestUser = async (): Promise<number> => {
  const passwordHash = 'hashed_password_123';
  
  const result = await db.insert(usersTable)
    .values({
      email: 'test@example.com',
      password_hash: passwordHash,
      first_name: 'John',
      last_name: 'Doe',
      role: 'student',
      profile_picture: null,
      bio: null,
      graduation_year: 2024,
      department: null,
      is_active: true
    })
    .returning()
    .execute();

  return result[0].id;
};

describe('updateUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update basic user information', async () => {
    const userId = await createTestUser();

    const updateInput: UpdateUserInput = {
      id: userId,
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane.smith@example.com'
    };

    const result = await updateUser(updateInput);

    expect(result.id).toEqual(userId);
    expect(result.first_name).toEqual('Jane');
    expect(result.last_name).toEqual('Smith');
    expect(result.email).toEqual('jane.smith@example.com');
    expect(result.role).toEqual('student'); // Should remain unchanged
    expect(result.is_active).toEqual(true); // Should remain unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update profile fields', async () => {
    const userId = await createTestUser();

    const updateInput: UpdateUserInput = {
      id: userId,
      profile_picture: 'https://example.com/new-pic.jpg',
      bio: 'Updated bio information',
      graduation_year: 2025
    };

    const result = await updateUser(updateInput);

    expect(result.id).toEqual(userId);
    expect(result.profile_picture).toEqual('https://example.com/new-pic.jpg');
    expect(result.bio).toEqual('Updated bio information');
    expect(result.graduation_year).toEqual(2025);
    expect(result.first_name).toEqual('John'); // Should remain unchanged
    expect(result.last_name).toEqual('Doe'); // Should remain unchanged
  });

  it('should update nullable fields to null', async () => {
    const userId = await createTestUser();

    // First set some values
    await updateUser({
      id: userId,
      profile_picture: 'https://example.com/pic.jpg',
      bio: 'Some bio',
      graduation_year: 2024,
      department: 'Computer Science'
    });

    // Then clear them
    const updateInput: UpdateUserInput = {
      id: userId,
      profile_picture: null,
      bio: null,
      graduation_year: null,
      department: null
    };

    const result = await updateUser(updateInput);

    expect(result.id).toEqual(userId);
    expect(result.profile_picture).toBeNull();
    expect(result.bio).toBeNull();
    expect(result.graduation_year).toBeNull();
    expect(result.department).toBeNull();
  });

  it('should update is_active status', async () => {
    const userId = await createTestUser();

    const updateInput: UpdateUserInput = {
      id: userId,
      is_active: false
    };

    const result = await updateUser(updateInput);

    expect(result.id).toEqual(userId);
    expect(result.is_active).toEqual(false);
    expect(result.first_name).toEqual('John'); // Other fields unchanged
  });

  it('should update department for teacher', async () => {
    // Create a teacher user
    const passwordHash = 'hashed_password_456';
    const teacherResult = await db.insert(usersTable)
      .values({
        email: 'teacher@example.com',
        password_hash: passwordHash,
        first_name: 'Prof',
        last_name: 'Smith',
        role: 'teacher',
        department: 'Mathematics'
      })
      .returning()
      .execute();

    const teacherId = teacherResult[0].id;

    const updateInput: UpdateUserInput = {
      id: teacherId,
      department: 'Computer Science'
    };

    const result = await updateUser(updateInput);

    expect(result.id).toEqual(teacherId);
    expect(result.department).toEqual('Computer Science');
    expect(result.role).toEqual('teacher');
  });

  it('should persist changes in database', async () => {
    const userId = await createTestUser();

    const updateInput: UpdateUserInput = {
      id: userId,
      first_name: 'Updated',
      bio: 'New bio'
    };

    await updateUser(updateInput);

    // Verify changes are persisted in database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].first_name).toEqual('Updated');
    expect(users[0].bio).toEqual('New bio');
    expect(users[0].last_name).toEqual('Doe'); // Unchanged field
  });

  it('should update updated_at timestamp', async () => {
    const userId = await createTestUser();

    // Get original timestamp
    const originalUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();
    
    const originalUpdatedAt = originalUser[0].updated_at;

    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const updateInput: UpdateUserInput = {
      id: userId,
      first_name: 'Updated'
    };

    const result = await updateUser(updateInput);

    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should throw error for non-existent user', async () => {
    const updateInput: UpdateUserInput = {
      id: 99999, // Non-existent ID
      first_name: 'Test'
    };

    await expect(updateUser(updateInput)).rejects.toThrow(/User with id 99999 not found/);
  });

  it('should handle partial updates correctly', async () => {
    const userId = await createTestUser();

    // Update only one field
    const updateInput: UpdateUserInput = {
      id: userId,
      bio: 'Only bio updated'
    };

    const result = await updateUser(updateInput);

    expect(result.id).toEqual(userId);
    expect(result.bio).toEqual('Only bio updated');
    expect(result.first_name).toEqual('John'); // Original value
    expect(result.last_name).toEqual('Doe'); // Original value
    expect(result.email).toEqual('test@example.com'); // Original value
    expect(result.role).toEqual('student'); // Original value
  });

  it('should handle empty update gracefully', async () => {
    const userId = await createTestUser();

    // Update with no optional fields (only id)
    const updateInput: UpdateUserInput = {
      id: userId
    };

    const result = await updateUser(updateInput);

    expect(result.id).toEqual(userId);
    expect(result.first_name).toEqual('John'); // All original values preserved
    expect(result.last_name).toEqual('Doe');
    expect(result.email).toEqual('test@example.com');
    expect(result.updated_at).toBeInstanceOf(Date); // Only updated_at should change
  });
});