import { db } from '../db';
import { privateMessagesTable } from '../db/schema';
import { type MarkMessageReadInput } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function markMessageRead(input: MarkMessageReadInput, userId: number): Promise<void> {
  try {
    // Verify the message exists and the user is the recipient
    const message = await db.select()
      .from(privateMessagesTable)
      .where(eq(privateMessagesTable.id, input.message_id))
      .limit(1)
      .execute();

    if (message.length === 0) {
      throw new Error('Message not found');
    }

    if (message[0].recipient_id !== userId) {
      throw new Error('Unauthorized: You can only mark your own messages as read');
    }

    // Mark the message as read
    await db.update(privateMessagesTable)
      .set({ is_read: true })
      .where(eq(privateMessagesTable.id, input.message_id))
      .execute();

  } catch (error) {
    console.error('Mark message read failed:', error);
    throw error;
  }
}

export async function markAllMessagesRead(senderId: number, recipientId: number): Promise<void> {
  try {
    // Mark all unread messages from the sender to the recipient as read
    await db.update(privateMessagesTable)
      .set({ is_read: true })
      .where(
        and(
          eq(privateMessagesTable.sender_id, senderId),
          eq(privateMessagesTable.recipient_id, recipientId),
          eq(privateMessagesTable.is_read, false)
        )
      )
      .execute();

  } catch (error) {
    console.error('Mark all messages read failed:', error);
    throw error;
  }
}