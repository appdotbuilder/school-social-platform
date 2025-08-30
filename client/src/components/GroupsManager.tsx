import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { trpc } from '@/utils/trpc';
import type { User, Group, CreateGroupInput } from '../../../server/src/schema';
import { 
  Users, 
  Plus, 
  Lock, 
  Globe, 
  Calendar,
  UserCheck,
  LogOut
} from 'lucide-react';

interface GroupsManagerProps {
  currentUser: User;
}

export function GroupsManager({ currentUser }: GroupsManagerProps) {
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState<CreateGroupInput>({
    name: '',
    description: null,
    is_private: false
  });
  const [creating, setCreating] = useState(false);

  const loadUserGroups = useCallback(async () => {
    try {
      setLoading(true);
      const groups = await trpc.getUserGroups.query({ userId: currentUser.id });
      setUserGroups(groups);
    } catch (error) {
      console.error('Failed to load user groups:', error);
      setUserGroups([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    loadUserGroups();
  }, [loadUserGroups]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setCreating(true);
    try {
      await trpc.createGroup.mutate({
        ...formData,
        ownerId: currentUser.id
      });
      
      setFormData({
        name: '',
        description: null,
        is_private: false
      });
      setShowCreateDialog(false);
      await loadUserGroups();
    } catch (error) {
      console.error('Failed to create group:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleLeaveGroup = async (groupId: number) => {
    try {
      await trpc.leaveGroup.mutate({ groupId, userId: currentUser.id });
      await loadUserGroups();
    } catch (error) {
      console.error('Failed to leave group:', error);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-gray-600">
            You're a member of {userGroups.length} group{userGroups.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>🆕 Create New Group</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Group Name *
                </label>
                <Input
                  placeholder="Enter group name..."
                  value={formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreateGroupInput) => ({ ...prev, name: e.target.value }))
                  }
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <Textarea
                  placeholder="What is this group about?"
                  value={formData.description || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setFormData((prev: CreateGroupInput) => ({
                      ...prev,
                      description: e.target.value || null
                    }))
                  }
                  className="min-h-[100px]"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_private"
                  checked={formData.is_private}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreateGroupInput) => ({ ...prev, is_private: e.target.checked }))
                  }
                  className="rounded border-gray-300"
                />
                <label htmlFor="is_private" className="text-sm text-gray-700">
                  Make this group private (invite only)
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Group'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Groups Grid */}
      {userGroups.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No groups yet!</h3>
            <p className="text-gray-600 mb-6">
              Join groups to connect with people who share your interests
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userGroups.map((group: Group) => (
            <Card key={group.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {group.name}
                      </h3>
                      {group.is_private ? (
                        <Lock className="w-4 h-4 text-gray-500" />
                      ) : (
                        <Globe className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Users className="w-3 h-3" />
                        <span>{group.member_count} member{group.member_count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(group.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <Avatar className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600">
                    <AvatarFallback className="text-white font-bold">
                      {group.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {group.description && (
                  <p className="text-sm text-gray-600 line-clamp-3">
                    {group.description}
                  </p>
                )}

                <div className="flex items-center space-x-2">
                  <Badge 
                    variant={group.is_private ? "secondary" : "outline"}
                    className={group.is_private ? "bg-yellow-100 text-yellow-800" : ""}
                  >
                    {group.is_private ? '🔒 Private' : '🌐 Public'}
                  </Badge>
                  
                  {group.owner_id === currentUser.id && (
                    <Badge className="bg-blue-100 text-blue-800">
                      <UserCheck className="w-3 h-3 mr-1" />
                      Owner
                    </Badge>
                  )}
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button variant="outline" size="sm">
                    <Users className="w-4 h-4 mr-2" />
                    View Members
                  </Button>
                  
                  {group.owner_id !== currentUser.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLeaveGroup(group.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4 mr-1" />
                      Leave
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Your Group Activity</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-1">
                {userGroups.length}
              </div>
              <p className="text-sm text-gray-600">Groups Joined</p>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-1">
                {userGroups.filter((g: Group) => g.owner_id === currentUser.id).length}
              </div>
              <p className="text-sm text-gray-600">Groups Created</p>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-1">
                {userGroups.reduce((sum: number, g: Group) => sum + g.member_count, 0)}
              </div>
              <p className="text-sm text-gray-600">Total Connections</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}