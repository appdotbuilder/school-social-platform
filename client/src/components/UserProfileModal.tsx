import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';
import type { User, UpdateUserInput } from '../../../server/src/schema';
import { 
  Edit, 
  Save, 
  X, 
  Mail, 
  Calendar, 
  Building,
  GraduationCap,
  User as UserIcon
} from 'lucide-react';

interface UserProfileModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedUser: User) => void;
}

export function UserProfileModal({ user, isOpen, onClose, onUpdate }: UserProfileModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<UpdateUserInput>({
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    profile_picture: user.profile_picture,
    bio: user.bio,
    graduation_year: user.graduation_year,
    department: user.department
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await trpc.updateUser.mutate(formData);
      
      // Create updated user object
      const updatedUser: User = {
        ...user,
        first_name: formData.first_name || user.first_name,
        last_name: formData.last_name || user.last_name,
        email: formData.email || user.email,
        profile_picture: formData.profile_picture ?? null,
        bio: formData.bio ?? null,
        graduation_year: formData.graduation_year ?? null,
        department: formData.department ?? null,
        updated_at: new Date()
      };
      
      onUpdate(updatedUser);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      profile_picture: user.profile_picture,
      bio: user.bio,
      graduation_year: user.graduation_year,
      department: user.department
    });
    setIsEditing(false);
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

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return '🛡️';
      case 'teacher': return '👨‍🏫';
      case 'student': return '🎓';
      case 'alumni': return '🎖️';
      default: return '👤';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <UserIcon className="w-5 h-5" />
            <span>User Profile</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Profile Header */}
          <div className="flex items-center space-x-6 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
            <div className="relative">
              <Avatar className="w-20 h-20 ring-4 ring-white shadow-lg">
                <AvatarImage src={user.profile_picture || undefined} />
                <AvatarFallback className="text-xl font-bold">
                  {user.first_name[0]}{user.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1">
                <Badge className={`${getRoleBadgeColor(user.role)} text-white text-xs px-2 py-1`}>
                  {getRoleIcon(user.role)} {user.role.toUpperCase()}
                </Badge>
              </div>
            </div>
            
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="First name"
                      value={formData.first_name || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: UpdateUserInput) => ({ ...prev, first_name: e.target.value }))
                      }
                    />
                    <Input
                      placeholder="Last name"
                      value={formData.last_name || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: UpdateUserInput) => ({ ...prev, last_name: e.target.value }))
                      }
                    />
                  </div>
                  <Input
                    type="url"
                    placeholder="Profile picture URL"
                    value={formData.profile_picture || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: UpdateUserInput) => ({
                        ...prev,
                        profile_picture: e.target.value || null
                      }))
                    }
                  />
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {user.first_name} {user.last_name}
                  </h2>
                  <div className="flex items-center space-x-2 mt-2">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600">{user.email}</span>
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-500">
                      Joined {user.created_at.toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex space-x-2">
              {isEditing ? (
                <>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    <Save className="w-4 h-4 mr-1" />
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Bio Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <span>📝 Bio</span>
            </h3>
            {isEditing ? (
              <Textarea
                placeholder="Tell us about yourself..."
                value={formData.bio || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setFormData((prev: UpdateUserInput) => ({
                    ...prev,
                    bio: e.target.value || null
                  }))
                }
                className="min-h-[100px]"
              />
            ) : (
              <div className="bg-gray-50 p-4 rounded-lg">
                {user.bio ? (
                  <p className="text-gray-700 whitespace-pre-wrap">{user.bio}</p>
                ) : (
                  <p className="text-gray-500 italic">No bio added yet</p>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Role-specific Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <span>ℹ️ Additional Information</span>
            </h3>
            
            {(user.role === 'student' || user.role === 'alumni') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-1">
                    <GraduationCap className="w-4 h-4" />
                    <span>Graduation Year</span>
                  </label>
                  {isEditing ? (
                    <Input
                      type="number"
                      placeholder="2024"
                      value={formData.graduation_year || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: UpdateUserInput) => ({
                          ...prev,
                          graduation_year: e.target.value ? parseInt(e.target.value) : null
                        }))
                      }
                      min="1950"
                      max="2050"
                    />
                  ) : (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="text-gray-700">
                        {user.graduation_year || 'Not specified'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {user.role === 'teacher' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-1">
                    <Building className="w-4 h-4" />
                    <span>Department</span>
                  </label>
                  {isEditing ? (
                    <Input
                      placeholder="Computer Science"
                      value={formData.department || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: UpdateUserInput) => ({
                          ...prev,
                          department: e.target.value || null
                        }))
                      }
                    />
                  ) : (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="text-gray-700">
                        {user.department || 'Not specified'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Account Status */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <span>⚙️ Account Status</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Status</span>
                  <Badge className={user.is_active ? 'bg-green-500' : 'bg-red-500'}>
                    {user.is_active ? '✅ Active' : '❌ Inactive'}
                  </Badge>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Last Updated</span>
                  <span className="text-sm text-gray-600">
                    {user.updated_at.toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}