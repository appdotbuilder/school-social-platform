import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, privateMessagesTable } from '../db/schema';
import { type MarkMessageReadInput } from '../schema';
import { markMessageRead, markAllMessagesRead } from '../handlers/mark_message_read';
import { eq, and } from 'drizzle-orm';

describe('markMessageRead', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should mark a message as read', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'sender@test.com',
          password_hash: 'hash1',
          first_name: 'John',
          last_name: 'Sender',
          role: 'student'
        },
        {
          email: 'recipient@test.com',
          password_hash: 'hash2',
          first_name: 'Jane',
          last_name: 'Recipient',
          role: 'student'
        }
      ])
      .returning()
      .execute();

    const senderId = users[0].id;
    const recipientId = users[1].id;

    // Create test message
    const messages = await db.insert(privateMessagesTable)
      .values({
        sender_id: senderId,
        recipient_id: recipientId,
        content: 'Test message',
        is_read: false
      })
      .returning()
      .execute();

    const messageId = messages[0].id;

    const input: MarkMessageReadInput = { message_id: messageId };

    // Mark message as read
    await markMessageRead(input, recipientId);

    // Verify message is marked as read
    const updatedMessage = await db.select()
      .from(privateMessagesTable)
      .where(eq(privateMessagesTable.id, messageId))
      .execute();

    expect(updatedMessage).toHaveLength(1);
    expect(updatedMessage[0].is_read).toBe(true);
    expect(updatedMessage[0].content).toBe('Test message');
  });

  it('should throw error when message does not exist', async () => {
    const input: MarkMessageReadInput = { message_id: 999 };

    await expect(markMessageRead(input, 1))
      .rejects
      .toThrow(/message not found/i);
  });

  it('should throw error when user is not the recipient', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'sender@test.com',
          password_hash: 'hash1',
          first_name: 'John',
          last_name: 'Sender',
          role: 'student'
        },
        {
          email: 'recipient@test.com',
          password_hash: 'hash2',
          first_name: 'Jane',
          last_name: 'Recipient',
          role: 'student'
        },
        {
          email: 'other@test.com',
          password_hash: 'hash3',
          first_name: 'Other',
          last_name: 'User',
          role: 'student'
        }
      ])
      .returning()
      .execute();

    const senderId = users[0].id;
    const recipientId = users[1].id;
    const otherId = users[2].id;

    // Create test message
    const messages = await db.insert(privateMessagesTable)
      .values({
        sender_id: senderId,
        recipient_id: recipientId,
        content: 'Test message',
        is_read: false
      })
      .returning()
      .execute();

    const messageId = messages[0].id;
    const input: MarkMessageReadInput = { message_id: messageId };

    // Try to mark message as read with wrong user
    await expect(markMessageRead(input, otherId))
      .rejects
      .toThrow(/unauthorized.*mark.*own.*message/i);

    // Verify message is still unread
    const message = await db.select()
      .from(privateMessagesTable)
      .where(eq(privateMessagesTable.id, messageId))
      .execute();

    expect(message[0].is_read).toBe(false);
  });

  it('should not affect already read messages', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'sender@test.com',
          password_hash: 'hash1',
          first_name: 'John',
          last_name: 'Sender',
          role: 'student'
        },
        {
          email: 'recipient@test.com',
          password_hash: 'hash2',
          first_name: 'Jane',
          last_name: 'Recipient',
          role: 'student'
        }
      ])
      .returning()
      .execute();

    const senderId = users[0].id;
    const recipientId = users[1].id;

    // Create already read message
    const messages = await db.insert(privateMessagesTable)
      .values({
        sender_id: senderId,
        recipient_id: recipientId,
        content: 'Already read message',
        is_read: true
      })
      .returning()
      .execute();

    const messageId = messages[0].id;
    const input: MarkMessageReadInput = { message_id: messageId };

    // Mark message as read (should not throw error)
    await markMessageRead(input, recipientId);

    // Verify message is still read
    const updatedMessage = await db.select()
      .from(privateMessagesTable)
      .where(eq(privateMessagesTable.id, messageId))
      .execute();

    expect(updatedMessage[0].is_read).toBe(true);
  });
});

describe('markAllMessagesRead', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should mark all unread messages from sender as read', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'sender@test.com',
          password_hash: 'hash1',
          first_name: 'John',
          last_name: 'Sender',
          role: 'student'
        },
        {
          email: 'recipient@test.com',
          password_hash: 'hash2',
          first_name: 'Jane',
          last_name: 'Recipient',
          role: 'student'
        }
      ])
      .returning()
      .execute();

    const senderId = users[0].id;
    const recipientId = users[1].id;

    // Create multiple messages - some read, some unread
    await db.insert(privateMessagesTable)
      .values([
        {
          sender_id: senderId,
          recipient_id: recipientId,
          content: 'Unread message 1',
          is_read: false
        },
        {
          sender_id: senderId,
          recipient_id: recipientId,
          content: 'Unread message 2',
          is_read: false
        },
        {
          sender_id: senderId,
          recipient_id: recipientId,
          content: 'Already read message',
          is_read: true
        }
      ])
      .execute();

    // Mark all messages from sender as read
    await markAllMessagesRead(senderId, recipientId);

    // Verify all messages from sender are now read
    const messages = await db.select()
      .from(privateMessagesTable)
      .where(
        and(
          eq(privateMessagesTable.sender_id, senderId),
          eq(privateMessagesTable.recipient_id, recipientId)
        )
      )
      .execute();

    expect(messages).toHaveLength(3);
    messages.forEach(message => {
      expect(message.is_read).toBe(true);
    });
  });

  it('should not affect messages from other senders', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'sender1@test.com',
          password_hash: 'hash1',
          first_name: 'John',
          last_name: 'Sender1',
          role: 'student'
        },
        {
          email: 'sender2@test.com',
          password_hash: 'hash2',
          first_name: 'Jane',
          last_name: 'Sender2',
          role: 'student'
        },
        {
          email: 'recipient@test.com',
          password_hash: 'hash3',
          first_name: 'Bob',
          last_name: 'Recipient',
          role: 'student'
        }
      ])
      .returning()
      .execute();

    const sender1Id = users[0].id;
    const sender2Id = users[1].id;
    const recipientId = users[2].id;

    // Create messages from different senders
    await db.insert(privateMessagesTable)
      .values([
        {
          sender_id: sender1Id,
          recipient_id: recipientId,
          content: 'Message from sender 1',
          is_read: false
        },
        {
          sender_id: sender2Id,
          recipient_id: recipientId,
          content: 'Message from sender 2',
          is_read: false
        }
      ])
      .execute();

    // Mark all messages from sender1 as read
    await markAllMessagesRead(sender1Id, recipientId);

    // Verify only messages from sender1 are read
    const sender1Messages = await db.select()
      .from(privateMessagesTable)
      .where(
        and(
          eq(privateMessagesTable.sender_id, sender1Id),
          eq(privateMessagesTable.recipient_id, recipientId)
        )
      )
      .execute();

    const sender2Messages = await db.select()
      .from(privateMessagesTable)
      .where(
        and(
          eq(privateMessagesTable.sender_id, sender2Id),
          eq(privateMessagesTable.recipient_id, recipientId)
        )
      )
      .execute();

    expect(sender1Messages[0].is_read).toBe(true);
    expect(sender2Messages[0].is_read).toBe(false);
  });

  it('should not affect messages to other recipients', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'sender@test.com',
          password_hash: 'hash1',
          first_name: 'John',
          last_name: 'Sender',
          role: 'student'
        },
        {
          email: 'recipient1@test.com',
          password_hash: 'hash2',
          first_name: 'Jane',
          last_name: 'Recipient1',
          role: 'student'
        },
        {
          email: 'recipient2@test.com',
          password_hash: 'hash3',
          first_name: 'Bob',
          last_name: 'Recipient2',
          role: 'student'
        }
      ])
      .returning()
      .execute();

    const senderId = users[0].id;
    const recipient1Id = users[1].id;
    const recipient2Id = users[2].id;

    // Create messages to different recipients
    await db.insert(privateMessagesTable)
      .values([
        {
          sender_id: senderId,
          recipient_id: recipient1Id,
          content: 'Message to recipient 1',
          is_read: false
        },
        {
          sender_id: senderId,
          recipient_id: recipient2Id,
          content: 'Message to recipient 2',
          is_read: false
        }
      ])
      .execute();

    // Mark all messages from sender to recipient1 as read
    await markAllMessagesRead(senderId, recipient1Id);

    // Verify only messages to recipient1 are read
    const recipient1Messages = await db.select()
      .from(privateMessagesTable)
      .where(
        and(
          eq(privateMessagesTable.sender_id, senderId),
          eq(privateMessagesTable.recipient_id, recipient1Id)
        )
      )
      .execute();

    const recipient2Messages = await db.select()
      .from(privateMessagesTable)
      .where(
        and(
          eq(privateMessagesTable.sender_id, senderId),
          eq(privateMessagesTable.recipient_id, recipient2Id)
        )
      )
      .execute();

    expect(recipient1Messages[0].is_read).toBe(true);
    expect(recipient2Messages[0].is_read).toBe(false);
  });

  it('should handle case with no unread messages', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'sender@test.com',
          password_hash: 'hash1',
          first_name: 'John',
          last_name: 'Sender',
          role: 'student'
        },
        {
          email: 'recipient@test.com',
          password_hash: 'hash2',
          first_name: 'Jane',
          last_name: 'Recipient',
          role: 'student'
        }
      ])
      .returning()
      .execute();

    const senderId = users[0].id;
    const recipientId = users[1].id;

    // Mark all messages as read (should not throw error even with no messages)
    await expect(markAllMessagesRead(senderId, recipientId))
      .resolves
      .toBeUndefined();
  });

  it('should handle case with all messages already read', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'sender@test.com',
          password_hash: 'hash1',
          first_name: 'John',
          last_name: 'Sender',
          role: 'student'
        },
        {
          email: 'recipient@test.com',
          password_hash: 'hash2',
          first_name: 'Jane',
          last_name: 'Recipient',
          role: 'student'
        }
      ])
      .returning()
      .execute();

    const senderId = users[0].id;
    const recipientId = users[1].id;

    // Create already read messages
    await db.insert(privateMessagesTable)
      .values([
        {
          sender_id: senderId,
          recipient_id: recipientId,
          content: 'Already read message 1',
          is_read: true
        },
        {
          sender_id: senderId,
          recipient_id: recipientId,
          content: 'Already read message 2',
          is_read: true
        }
      ])
      .execute();

    // Mark all messages as read (should not cause issues)
    await markAllMessagesRead(senderId, recipientId);

    // Verify messages are still read
    const messages = await db.select()
      .from(privateMessagesTable)
      .where(
        and(
          eq(privateMessagesTable.sender_id, senderId),
          eq(privateMessagesTable.recipient_id, recipientId)
        )
      )
      .execute();

    expect(messages).toHaveLength(2);
    messages.forEach(message => {
      expect(message.is_read).toBe(true);
    });
  });
});