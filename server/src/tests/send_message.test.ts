import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, privateMessagesTable } from '../db/schema';
import { type SendMessageInput } from '../schema';
import { sendMessage } from '../handlers/send_message';
import { eq } from 'drizzle-orm';


// Test users
const testSender = {
  email: 'sender@test.com',
  password_hash: 'hashed_password_123',
  first_name: 'John',
  last_name: 'Sender',
  role: 'student' as const,
  profile_picture: null,
  bio: null,
  graduation_year: 2024,
  department: null
};

const testRecipient = {
  email: 'recipient@test.com',
  password_hash: 'hashed_password_456',
  first_name: 'Jane',
  last_name: 'Recipient',
  role: 'teacher' as const,
  profile_picture: null,
  bio: null,
  graduation_year: null,
  department: 'Computer Science'
};

const testInput: SendMessageInput = {
  recipient_id: 2, // Will be updated after creating users
  content: 'Hello, this is a test message!'
};

describe('sendMessage', () => {
  let senderId: number;
  let recipientId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test users
    const senderResult = await db.insert(usersTable)
      .values(testSender)
      .returning()
      .execute();
    
    const recipientResult = await db.insert(usersTable)
      .values(testRecipient)
      .returning()
      .execute();

    senderId = senderResult[0].id;
    recipientId = recipientResult[0].id;
    testInput.recipient_id = recipientId;
  });

  afterEach(resetDB);

  it('should send a message successfully', async () => {
    const result = await sendMessage(testInput, senderId);

    // Verify message properties
    expect(result.sender_id).toEqual(senderId);
    expect(result.recipient_id).toEqual(recipientId);
    expect(result.content).toEqual('Hello, this is a test message!');
    expect(result.is_read).toBe(false);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save message to database', async () => {
    const result = await sendMessage(testInput, senderId);

    // Query the database to verify message was saved
    const messages = await db.select()
      .from(privateMessagesTable)
      .where(eq(privateMessagesTable.id, result.id))
      .execute();

    expect(messages).toHaveLength(1);
    expect(messages[0].sender_id).toEqual(senderId);
    expect(messages[0].recipient_id).toEqual(recipientId);
    expect(messages[0].content).toEqual('Hello, this is a test message!');
    expect(messages[0].is_read).toBe(false);
    expect(messages[0].created_at).toBeInstanceOf(Date);
  });

  it('should throw error when sender does not exist', async () => {
    const nonExistentSenderId = 99999;

    await expect(sendMessage(testInput, nonExistentSenderId))
      .rejects.toThrow(/sender not found/i);
  });

  it('should throw error when recipient does not exist', async () => {
    const invalidInput: SendMessageInput = {
      recipient_id: 99999,
      content: 'Test message'
    };

    await expect(sendMessage(invalidInput, senderId))
      .rejects.toThrow(/recipient not found/i);
  });

  it('should throw error when trying to send message to self', async () => {
    const selfMessageInput: SendMessageInput = {
      recipient_id: senderId,
      content: 'Message to myself'
    };

    await expect(sendMessage(selfMessageInput, senderId))
      .rejects.toThrow(/cannot send message to yourself/i);
  });

  it('should handle empty content properly', async () => {
    const emptyContentInput: SendMessageInput = {
      recipient_id: recipientId,
      content: ''
    };

    const result = await sendMessage(emptyContentInput, senderId);
    expect(result.content).toEqual('');
    expect(result.sender_id).toEqual(senderId);
    expect(result.recipient_id).toEqual(recipientId);
  });

  it('should handle long messages', async () => {
    const longMessage = 'A'.repeat(1000);
    const longMessageInput: SendMessageInput = {
      recipient_id: recipientId,
      content: longMessage
    };

    const result = await sendMessage(longMessageInput, senderId);
    expect(result.content).toEqual(longMessage);
    expect(result.content.length).toEqual(1000);
  });

  it('should create messages between different user roles', async () => {
    // Create admin user
    const adminUser = {
      email: 'admin@test.com',
      password_hash: 'hashed_password_admin',
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin' as const,
      profile_picture: null,
      bio: null,
      graduation_year: null,
      department: null
    };

    const adminResult = await db.insert(usersTable)
      .values(adminUser)
      .returning()
      .execute();

    const adminId = adminResult[0].id;

    // Send message from admin to student
    const adminToStudentInput: SendMessageInput = {
      recipient_id: senderId, // senderId is student
      content: 'Message from admin to student'
    };

    const result = await sendMessage(adminToStudentInput, adminId);
    expect(result.sender_id).toEqual(adminId);
    expect(result.recipient_id).toEqual(senderId);
    expect(result.content).toEqual('Message from admin to student');
  });

  it('should maintain message creation timestamp accuracy', async () => {
    const beforeSend = new Date();
    const result = await sendMessage(testInput, senderId);
    const afterSend = new Date();

    expect(result.created_at.getTime()).toBeGreaterThanOrEqual(beforeSend.getTime());
    expect(result.created_at.getTime()).toBeLessThanOrEqual(afterSend.getTime());
  });
});