import { db } from '../db';
import { privateMessagesTable } from '../db/schema';
import { type PrivateMessage } from '../schema';
import { eq, or, and, desc, count, sql } from 'drizzle-orm';

export async function getMessages(userId: number, otherUserId?: number): Promise<PrivateMessage[]> {
  try {
    if (otherUserId !== undefined) {
      // Get messages between two specific users
      const results = await db.select()
        .from(privateMessagesTable)
        .where(
          or(
            and(
              eq(privateMessagesTable.sender_id, userId),
              eq(privateMessagesTable.recipient_id, otherUserId)
            ),
            and(
              eq(privateMessagesTable.sender_id, otherUserId),
              eq(privateMessagesTable.recipient_id, userId)
            )
          )
        )
        .orderBy(desc(privateMessagesTable.created_at));

      return results;
    } else {
      // Get all messages for the user (either sent or received)
      const results = await db.select()
        .from(privateMessagesTable)
        .where(
          or(
            eq(privateMessagesTable.sender_id, userId),
            eq(privateMessagesTable.recipient_id, userId)
          )
        )
        .orderBy(desc(privateMessagesTable.created_at));

      return results;
    }
  } catch (error) {
    console.error('Failed to get messages:', error);
    throw error;
  }
}

export async function getConversations(userId: number): Promise<{ user_id: number; last_message: PrivateMessage; unread_count: number }[]> {
  try {
    // Get all conversation partners using a simple approach
    const allMessages = await db.select()
      .from(privateMessagesTable)
      .where(
        or(
          eq(privateMessagesTable.sender_id, userId),
          eq(privateMessagesTable.recipient_id, userId)
        )
      )
      .orderBy(desc(privateMessagesTable.created_at));

    // Group messages by conversation partner
    const conversationMap = new Map<number, PrivateMessage>();
    const partnerSet = new Set<number>();

    for (const message of allMessages) {
      const partnerId = message.sender_id === userId ? message.recipient_id : message.sender_id;
      
      // Add to set of partners
      partnerSet.add(partnerId);
      
      // Keep track of the most recent message per conversation
      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, message);
      }
    }

    const conversations = [];

    // For each partner, get unread count and create conversation object
    for (const partnerId of partnerSet) {
      const lastMessage = conversationMap.get(partnerId)!;

      // Get unread count (messages from partner to current user that are unread)
      const unreadResult = await db.select({ count: count() })
        .from(privateMessagesTable)
        .where(
          and(
            eq(privateMessagesTable.sender_id, partnerId),
            eq(privateMessagesTable.recipient_id, userId),
            eq(privateMessagesTable.is_read, false)
          )
        );

      conversations.push({
        user_id: partnerId,
        last_message: lastMessage,
        unread_count: unreadResult[0]?.count || 0
      });
    }

    // Sort conversations by last message timestamp (newest first)
    conversations.sort((a, b) => {
      return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime();
    });

    return conversations;
  } catch (error) {
    console.error('Failed to get conversations:', error);
    throw error;
  }
}