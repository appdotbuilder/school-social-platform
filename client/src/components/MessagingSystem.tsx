import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/utils/trpc';
import type { User, PrivateMessage, SendMessageInput } from '../../../server/src/schema';
import { 
  Send, 
  Search, 
  MessageCircle, 
  User as UserIcon,
  Clock
} from 'lucide-react';

interface Conversation {
  userId: number;
  firstName: string;
  lastName: string;
  profilePicture: string | null;
  role: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
}

interface MessagingSystemProps {
  currentUser: User;
  users: User[];
}

export function MessagingSystem({ currentUser, users }: MessagingSystemProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const convs = await trpc.getConversations.query({ userId: currentUser.id });
      
      // Note: Handler currently returns empty array as placeholder
      // In a real implementation, this would return conversation data
      // For now, we'll handle empty response gracefully
      const formattedConversations: Conversation[] = convs.map((conv: { user_id: number; last_message: { id: number; sender_id: number; recipient_id: number; content: string; is_read: boolean; created_at: Date }; unread_count: number }) => {
        // Handle the actual handler return structure when implemented
        if (conv.last_message && conv.last_message.sender_id) {
          const otherUserId = conv.last_message.sender_id === currentUser.id 
            ? conv.last_message.recipient_id 
            : conv.last_message.sender_id;
          
          // Find user info from available users list
          const otherUser = users.find(u => u.id === otherUserId);
          
          return {
            userId: otherUserId,
            firstName: otherUser?.first_name || 'Unknown',
            lastName: otherUser?.last_name || 'User',
            profilePicture: otherUser?.profile_picture || null,
            role: otherUser?.role || 'student',
            lastMessage: conv.last_message.content,
            lastMessageTime: conv.last_message.created_at,
            unreadCount: conv.unread_count || 0
          };
        }
        
        // Fallback for any other structure
        return {
          userId: conv.user_id || 0,
          firstName: 'Unknown',
          lastName: 'User',
          profilePicture: null,
          role: 'student',
          lastMessage: 'No messages',
          lastMessageTime: new Date(),
          unreadCount: 0
        };
      });
      
      setConversations(formattedConversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.id, users]);

  const loadMessages = useCallback(async (otherUserId: number) => {
    try {
      const msgs = await trpc.getMessages.query({ 
        userId: currentUser.id, 
        otherUserId 
      });
      setMessages(msgs);
      
      // Mark messages as read
      await trpc.markAllMessagesRead.mutate({
        senderId: otherUserId,
        recipientId: currentUser.id
      });
      
      // Refresh conversations to update unread count
      loadConversations();
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, [currentUser.id, loadConversations]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedUserId) {
      loadMessages(selectedUserId);
    }
  }, [selectedUserId, loadMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUserId) return;

    setSending(true);
    try {
      const messageData: SendMessageInput = {
        recipient_id: selectedUserId,
        content: newMessage.trim()
      };

      await trpc.sendMessage.mutate({
        ...messageData,
        senderId: currentUser.id
      });

      setNewMessage('');
      await loadMessages(selectedUserId);
      await loadConversations();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const startConversation = (userId: number) => {
    setSelectedUserId(userId);
    // If this is a new conversation, initialize empty messages
    if (!conversations.find(conv => conv.userId === userId)) {
      setMessages([]);
    }
  };

  const formatMessageTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500';
      case 'teacher': return 'bg-blue-500';
      case 'student': return 'bg-green-500';
      case 'alumni': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const availableUsers = users
    .filter((user: User) => 
      user.id !== currentUser.id && 
      user.is_active &&
      (user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       user.email.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .slice(0, 10);

  const selectedUser = selectedUserId ? 
    users.find((user: User) => user.id === selectedUserId) ||
    conversations.find((conv: Conversation) => conv.userId === selectedUserId)
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
      {/* Conversations Sidebar */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageCircle className="w-5 h-5" />
            <span>Conversations</span>
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[450px]">
            {/* Existing Conversations */}
            {conversations.length > 0 && (
              <div className="p-4 space-y-2">
                <h4 className="text-sm font-medium text-gray-500 mb-3">Recent Chats</h4>
                {conversations.map((conv: Conversation) => (
                  <div
                    key={conv.userId}
                    onClick={() => setSelectedUserId(conv.userId)}
                    className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedUserId === conv.userId
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={conv.profilePicture || undefined} />
                      <AvatarFallback>
                        {conv.firstName[0]}{conv.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm text-gray-900 truncate">
                          {conv.firstName} {conv.lastName}
                        </p>
                        {conv.unreadCount > 0 && (
                          <Badge className="bg-blue-500 text-white text-xs">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {conv.lastMessage}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <Badge className={`${getRoleBadgeColor(conv.role)} text-white text-xs`}>
                          {conv.role}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {formatMessageTime(conv.lastMessageTime)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Available Users to Start New Conversations */}
            {searchTerm && availableUsers.length > 0 && (
              <>
                <Separator />
                <div className="p-4 space-y-2">
                  <h4 className="text-sm font-medium text-gray-500 mb-3">Start New Chat</h4>
                  {availableUsers.map((user: User) => (
                    <div
                      key={user.id}
                      onClick={() => startConversation(user.id)}
                      className="flex items-center space-x-3 p-3 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={user.profile_picture || undefined} />
                        <AvatarFallback>
                          {user.first_name[0]}{user.last_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">
                          {user.first_name} {user.last_name}
                        </p>
                        <div className="flex items-center space-x-2">
                          <Badge className={`${getRoleBadgeColor(user.role)} text-white text-xs`}>
                            {user.role}
                          </Badge>
                          <span className="text-xs text-gray-500">{user.email}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!loading && conversations.length === 0 && !searchTerm && (
              <div className="p-8 text-center text-gray-500">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs mt-1">Search for users to start chatting</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat Area */}
      <Card className="lg:col-span-2">
        {selectedUserId && selectedUser ? (
          <>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-4">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={
                    'profilePicture' in selectedUser ? selectedUser.profilePicture || undefined :
                    selectedUser.profile_picture || undefined
                  } />
                  <AvatarFallback>
                    {'firstName' in selectedUser ? 
                      selectedUser.firstName[0] + selectedUser.lastName[0] :
                      selectedUser.first_name[0] + selectedUser.last_name[0]
                    }
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {'firstName' in selectedUser ? 
                      `${selectedUser.firstName} ${selectedUser.lastName}` :
                      `${selectedUser.first_name} ${selectedUser.last_name}`
                    }
                  </h3>
                  <Badge className={`${getRoleBadgeColor(
                    'role' in selectedUser ? selectedUser.role : 'student'
                  )} text-white text-xs`}>
                    {'role' in selectedUser ? selectedUser.role : 'student'}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <Separator />

            <CardContent className="p-0 flex flex-col h-[500px]">
              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs mt-1">Start the conversation!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message: PrivateMessage) => {
                      const isSent = message.sender_id === currentUser.id;
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                              isSent
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            <div className={`flex items-center space-x-1 mt-1 ${
                              isSent ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                              <Clock className="w-3 h-3" />
                              <span className="text-xs">
                                {formatMessageTime(message.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              {/* Message Input */}
              <div className="p-4 border-t">
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
                    disabled={sending}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={sending || !newMessage.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <UserIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
              <p className="text-sm">Choose someone to start messaging</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}