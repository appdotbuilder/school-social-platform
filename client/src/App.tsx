import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserProfileModal } from '@/components/UserProfileModal';
import { NewsFeed } from '@/components/NewsFeed';
import { CreatePost } from '@/components/CreatePost';
import { MessagingSystem } from '@/components/MessagingSystem';
import { GroupsManager } from '@/components/GroupsManager';
import { AdminDashboard } from '@/components/AdminDashboard';
import { UserManagement } from '@/components/UserManagement';
import { trpc } from '@/utils/trpc';
import type { User } from '../../server/src/schema';
import { 
  Users, 
  MessageSquare, 
  Users as GroupsIcon, 
  Shield,
  LogOut,
  Settings,
  Home,
  PlusCircle
} from 'lucide-react';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<string>('feed');
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);

  // Load users on app start
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const allUsers = await trpc.getUsers.query();
        setUsers(allUsers);
        // For demo purposes, set first active user as current user
        const activeUser = allUsers.find(user => user.is_active) || allUsers[0];
        setCurrentUser(activeUser || null);
      } catch (error) {
        console.error('Failed to load users:', error);
      }
    };
    loadUsers();
  }, []);

  const handleUserSwitch = (user: User) => {
    setCurrentUser(user);
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

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">🎓 SchoolConnect</h1>
            <p className="text-gray-600 mb-6">Loading your social network...</p>
            {users.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500 mb-4">Select a user to continue:</p>
                {users.filter(user => user.is_active).slice(0, 5).map((user: User) => (
                  <Button
                    key={user.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleUserSwitch(user)}
                  >
                    <Avatar className="w-6 h-6 mr-2">
                      <AvatarImage src={user.profile_picture || undefined} />
                      <AvatarFallback>{user.first_name[0]}{user.last_name[0]}</AvatarFallback>
                    </Avatar>
                    <span>{user.first_name} {user.last_name}</span>
                    <Badge className={`ml-auto ${getRoleBadgeColor(user.role)} text-white`}>
                      {user.role}
                    </Badge>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">🎓 SchoolConnect</h1>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreatePost(true)}
                className="hidden sm:flex"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Create Post
              </Button>

              <div className="flex items-center space-x-3">
                <Avatar 
                  className="cursor-pointer ring-2 ring-blue-500"
                  onClick={() => setShowUserProfile(true)}
                >
                  <AvatarImage src={currentUser.profile_picture || undefined} />
                  <AvatarFallback>
                    {currentUser.first_name[0]}{currentUser.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">
                    {currentUser.first_name} {currentUser.last_name}
                  </p>
                  <Badge className={`${getRoleBadgeColor(currentUser.role)} text-white text-xs`}>
                    {currentUser.role}
                  </Badge>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCurrentUser(null);
                  setActiveTab('feed');
                }}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 bg-white rounded-xl shadow-sm p-1">
            <TabsTrigger value="feed" className="flex items-center space-x-2">
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Feed</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Messages</span>
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex items-center space-x-2">
              <GroupsIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Groups</span>
            </TabsTrigger>
            {currentUser.role === 'admin' && (
              <>
                <TabsTrigger value="admin" className="flex items-center space-x-2">
                  <Shield className="w-4 h-4" />
                  <span className="hidden sm:inline">Admin</span>
                </TabsTrigger>
                <TabsTrigger value="users" className="flex items-center space-x-2">
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Users</span>
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="feed" className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">📚 News Feed</h2>
              <p className="text-gray-600 mb-6">Stay connected with your school community</p>
            </div>
            
            {/* Mobile Create Post Button */}
            <div className="sm:hidden">
              <Button
                onClick={() => setShowCreatePost(true)}
                className="w-full mb-4"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Create Post
              </Button>
            </div>

            <NewsFeed currentUser={currentUser} />
          </TabsContent>

          <TabsContent value="messages" className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">💬 Messages</h2>
              <p className="text-gray-600 mb-6">Connect privately with your peers</p>
            </div>
            <MessagingSystem currentUser={currentUser} users={users} />
          </TabsContent>

          <TabsContent value="groups" className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">👥 Groups</h2>
              <p className="text-gray-600 mb-6">Join communities and collaborate</p>
            </div>
            <GroupsManager currentUser={currentUser} />
          </TabsContent>

          {currentUser.role === 'admin' && (
            <>
              <TabsContent value="admin" className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">🛡️ Admin Dashboard</h2>
                  <p className="text-gray-600 mb-6">Monitor and manage your school community</p>
                </div>
                <AdminDashboard />
              </TabsContent>

              <TabsContent value="users" className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">⚙️ User Management</h2>
                  <p className="text-gray-600 mb-6">Manage users and their permissions</p>
                </div>
                <UserManagement currentUser={currentUser} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>

      {/* Modals */}
      {showUserProfile && (
        <UserProfileModal
          user={currentUser}
          isOpen={showUserProfile}
          onClose={() => setShowUserProfile(false)}
          onUpdate={(updatedUser: User) => {
            setCurrentUser(updatedUser);
            setUsers((prev: User[]) => 
              prev.map((u: User) => u.id === updatedUser.id ? updatedUser : u)
            );
          }}
        />
      )}

      {showCreatePost && (
        <CreatePost
          currentUser={currentUser}
          isOpen={showCreatePost}
          onClose={() => setShowCreatePost(false)}
        />
      )}
    </div>
  );
}

export default App;