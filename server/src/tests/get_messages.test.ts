import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, privateMessagesTable } from '../db/schema';
import { getMessages, getConversations } from '../handlers/get_messages';
import { type CreateUserInput } from '../schema';

describe('getMessages and getConversations', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test users
  const createTestUser = async (userData: Partial<CreateUserInput> & { email: string }) => {
    const result = await db.insert(usersTable)
      .values({
        email: userData.email,
        password_hash: 'hashed_password_123', // Simple static hash for testing
        first_name: userData.first_name || 'Test',
        last_name: userData.last_name || 'User',
        role: userData.role || 'student',
        profile_picture: userData.profile_picture || null,
        bio: userData.bio || null,
        graduation_year: userData.graduation_year || null,
        department: userData.department || null
      })
      .returning();
    return result[0];
  };

  // Helper function to create test messages
  const createTestMessage = async (senderId: number, recipientId: number, content: string, isRead: boolean = false) => {
    const result = await db.insert(privateMessagesTable)
      .values({
        sender_id: senderId,
        recipient_id: recipientId,
        content,
        is_read: isRead
      })
      .returning();
    return result[0];
  };

  describe('getMessages', () => {
    it('should return messages between two specific users', async () => {
      // Create test users
      const user1 = await createTestUser({ email: 'user1@test.com', first_name: 'User', last_name: 'One' });
      const user2 = await createTestUser({ email: 'user2@test.com', first_name: 'User', last_name: 'Two' });
      const user3 = await createTestUser({ email: 'user3@test.com', first_name: 'User', last_name: 'Three' });

      // Create messages between user1 and user2
      await createTestMessage(user1.id, user2.id, 'Hello from user1 to user2');
      await createTestMessage(user2.id, user1.id, 'Reply from user2 to user1');
      
      // Create a message between user1 and user3 (should not be included)
      await createTestMessage(user1.id, user3.id, 'Message to user3');

      const messages = await getMessages(user1.id, user2.id);

      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('Reply from user2 to user1'); // Most recent first
      expect(messages[1].content).toBe('Hello from user1 to user2');
      
      // Verify all messages involve both users
      messages.forEach(message => {
        expect(
          (message.sender_id === user1.id && message.recipient_id === user2.id) ||
          (message.sender_id === user2.id && message.recipient_id === user1.id)
        ).toBe(true);
      });
    });

    it('should return all messages for a user when otherUserId is not provided', async () => {
      // Create test users
      const user1 = await createTestUser({ email: 'user1@test.com', first_name: 'User', last_name: 'One' });
      const user2 = await createTestUser({ email: 'user2@test.com', first_name: 'User', last_name: 'Two' });
      const user3 = await createTestUser({ email: 'user3@test.com', first_name: 'User', last_name: 'Three' });

      // Create messages involving user1
      await createTestMessage(user1.id, user2.id, 'Message to user2');
      await createTestMessage(user2.id, user1.id, 'Reply from user2');
      await createTestMessage(user1.id, user3.id, 'Message to user3');
      await createTestMessage(user3.id, user1.id, 'Reply from user3');
      
      // Create a message not involving user1 (should not be included)
      await createTestMessage(user2.id, user3.id, 'Message between user2 and user3');

      const messages = await getMessages(user1.id);

      expect(messages).toHaveLength(4);
      
      // Verify all messages involve user1
      messages.forEach(message => {
        expect(
          message.sender_id === user1.id || message.recipient_id === user1.id
        ).toBe(true);
      });
    });

    it('should return messages ordered by creation time (newest first)', async () => {
      // Create test users
      const user1 = await createTestUser({ email: 'user1@test.com', first_name: 'User', last_name: 'One' });
      const user2 = await createTestUser({ email: 'user2@test.com', first_name: 'User', last_name: 'Two' });

      // Create messages with some delay to ensure different timestamps
      const message1 = await createTestMessage(user1.id, user2.id, 'First message');
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      const message2 = await createTestMessage(user2.id, user1.id, 'Second message');
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      const message3 = await createTestMessage(user1.id, user2.id, 'Third message');

      const messages = await getMessages(user1.id, user2.id);

      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('Third message');
      expect(messages[1].content).toBe('Second message');
      expect(messages[2].content).toBe('First message');
    });

    it('should return empty array when no messages exist', async () => {
      // Create test users
      const user1 = await createTestUser({ email: 'user1@test.com', first_name: 'User', last_name: 'One' });
      const user2 = await createTestUser({ email: 'user2@test.com', first_name: 'User', last_name: 'Two' });

      const messages = await getMessages(user1.id, user2.id);

      expect(messages).toHaveLength(0);
    });

    it('should handle case when user has no messages at all', async () => {
      // Create test user
      const user1 = await createTestUser({ email: 'user1@test.com', first_name: 'User', last_name: 'One' });

      const messages = await getMessages(user1.id);

      expect(messages).toHaveLength(0);
    });
  });

  describe('getConversations', () => {
    it('should return conversation summaries with last message and unread count', async () => {
      // Create test users
      const user1 = await createTestUser({ email: 'user1@test.com', first_name: 'User', last_name: 'One' });
      const user2 = await createTestUser({ email: 'user2@test.com', first_name: 'User', last_name: 'Two' });
      const user3 = await createTestUser({ email: 'user3@test.com', first_name: 'User', last_name: 'Three' });

      // Create conversation with user2
      await createTestMessage(user1.id, user2.id, 'First message to user2', true);
      await createTestMessage(user2.id, user1.id, 'Unread reply from user2', false);
      const lastMessageUser2 = await createTestMessage(user1.id, user2.id, 'Latest message to user2', true);

      // Create conversation with user3
      await createTestMessage(user3.id, user1.id, 'Unread message from user3', false);
      const lastMessageUser3 = await createTestMessage(user1.id, user3.id, 'Latest message to user3', true);

      const conversations = await getConversations(user1.id);

      expect(conversations).toHaveLength(2);

      // Find conversations by user_id
      const conversationWithUser2 = conversations.find(c => c.user_id === user2.id);
      const conversationWithUser3 = conversations.find(c => c.user_id === user3.id);

      expect(conversationWithUser2).toBeDefined();
      expect(conversationWithUser2!.last_message.content).toBe('Latest message to user2');
      expect(conversationWithUser2!.unread_count).toBe(1); // One unread message from user2

      expect(conversationWithUser3).toBeDefined();
      expect(conversationWithUser3!.last_message.content).toBe('Latest message to user3');
      expect(conversationWithUser3!.unread_count).toBe(1); // One unread message from user3
    });

    it('should return conversations ordered by last message timestamp', async () => {
      // Create test users
      const user1 = await createTestUser({ email: 'user1@test.com', first_name: 'User', last_name: 'One' });
      const user2 = await createTestUser({ email: 'user2@test.com', first_name: 'User', last_name: 'Two' });
      const user3 = await createTestUser({ email: 'user3@test.com', first_name: 'User', last_name: 'Three' });

      // Create older conversation with user2
      await createTestMessage(user1.id, user2.id, 'Old message to user2', true);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Create newer conversation with user3
      await createTestMessage(user1.id, user3.id, 'Newer message to user3', true);

      const conversations = await getConversations(user1.id);

      expect(conversations).toHaveLength(2);
      // Should be ordered by most recent conversation first
      expect(conversations[0].user_id).toBe(user3.id);
      expect(conversations[1].user_id).toBe(user2.id);
    });

    it('should return zero unread count when all messages are read', async () => {
      // Create test users
      const user1 = await createTestUser({ email: 'user1@test.com', first_name: 'User', last_name: 'One' });
      const user2 = await createTestUser({ email: 'user2@test.com', first_name: 'User', last_name: 'Two' });

      // Create all read messages
      await createTestMessage(user1.id, user2.id, 'Message to user2', true);
      await createTestMessage(user2.id, user1.id, 'Read reply from user2', true);

      const conversations = await getConversations(user1.id);

      expect(conversations).toHaveLength(1);
      expect(conversations[0].unread_count).toBe(0);
    });

    it('should return empty array when user has no conversations', async () => {
      // Create test user
      const user1 = await createTestUser({ email: 'user1@test.com', first_name: 'User', last_name: 'One' });

      const conversations = await getConversations(user1.id);

      expect(conversations).toHaveLength(0);
    });

    it('should handle conversations where user is only sender', async () => {
      // Create test users
      const user1 = await createTestUser({ email: 'user1@test.com', first_name: 'User', last_name: 'One' });
      const user2 = await createTestUser({ email: 'user2@test.com', first_name: 'User', last_name: 'Two' });

      // User1 sends message but user2 never replies
      await createTestMessage(user1.id, user2.id, 'One-way message', true);

      const conversations = await getConversations(user1.id);

      expect(conversations).toHaveLength(1);
      expect(conversations[0].user_id).toBe(user2.id);
      expect(conversations[0].last_message.content).toBe('One-way message');
      expect(conversations[0].unread_count).toBe(0); // No unread messages from user2
    });

    it('should handle conversations where user is only recipient', async () => {
      // Create test users
      const user1 = await createTestUser({ email: 'user1@test.com', first_name: 'User', last_name: 'One' });
      const user2 = await createTestUser({ email: 'user2@test.com', first_name: 'User', last_name: 'Two' });

      // User2 sends message but user1 never replies
      await createTestMessage(user2.id, user1.id, 'Incoming message', false);

      const conversations = await getConversations(user1.id);

      expect(conversations).toHaveLength(1);
      expect(conversations[0].user_id).toBe(user2.id);
      expect(conversations[0].last_message.content).toBe('Incoming message');
      expect(conversations[0].unread_count).toBe(1); // One unread message from user2
    });
  });
});