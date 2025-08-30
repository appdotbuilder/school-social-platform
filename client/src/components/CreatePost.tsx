import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/utils/trpc';
import type { User, CreatePostInput } from '../../../server/src/schema';
import { 
  Image, 
  X, 
  Loader2,
  Camera,
  Film
} from 'lucide-react';

interface CreatePostProps {
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePost({ currentUser, isOpen, onClose }: CreatePostProps) {
  const [formData, setFormData] = useState<CreatePostInput>({
    content: '',
    image_url: null,
    video_url: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content.trim()) return;

    setIsSubmitting(true);
    try {
      await trpc.createPost.mutate({
        ...formData,
        authorId: currentUser.id
      });
      
      // Reset form and close modal
      setFormData({
        content: '',
        image_url: null,
        video_url: null
      });
      onClose();
      
      // Refresh the page to show new post
      window.location.reload();
    } catch (error) {
      console.error('Failed to create post:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeMedia = () => {
    setFormData((prev: CreatePostInput) => ({
      ...prev,
      image_url: null,
      video_url: null
    }));
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <span>📝 Create Post</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Author Info */}
          <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
            <Avatar className="w-12 h-12">
              <AvatarImage src={currentUser.profile_picture || undefined} />
              <AvatarFallback>
                {currentUser.first_name[0]}{currentUser.last_name[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-gray-900">
                  {currentUser.first_name} {currentUser.last_name}
                </h3>
                <Badge className={`${getRoleBadgeColor(currentUser.role)} text-white text-xs`}>
                  {currentUser.role}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">Posting to your school feed</p>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Textarea
              placeholder="What's on your mind? Share with your school community..."
              value={formData.content}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setFormData((prev: CreatePostInput) => ({ ...prev, content: e.target.value }))
              }
              className="min-h-[120px] resize-none border-2 border-gray-200 focus:border-blue-500 transition-colors"
              required
            />
          </div>

          {/* Media Inputs */}
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Camera className="w-4 h-4 inline mr-1" />
                  Image URL (optional)
                </label>
                <Input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={formData.image_url || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreatePostInput) => ({
                      ...prev,
                      image_url: e.target.value || null,
                      video_url: null // Clear video if image is added
                    }))
                  }
                  disabled={!!formData.video_url}
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Film className="w-4 h-4 inline mr-1" />
                  Video URL (optional)
                </label>
                <Input
                  type="url"
                  placeholder="https://example.com/video.mp4"
                  value={formData.video_url || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreatePostInput) => ({
                      ...prev,
                      video_url: e.target.value || null,
                      image_url: null // Clear image if video is added
                    }))
                  }
                  disabled={!!formData.image_url}
                />
              </div>
            </div>

            {(formData.image_url || formData.video_url) && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {formData.image_url ? '🖼️ Image Preview' : '🎬 Video Preview'}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeMedia}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                {formData.image_url && (
                  <img
                    src={formData.image_url}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-md"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                )}
                
                {formData.video_url && (
                  <video
                    src={formData.video_url}
                    className="w-full h-48 object-cover rounded-md"
                    controls
                    onError={(e) => {
                      const target = e.target as HTMLVideoElement;
                      target.style.display = 'none';
                    }}
                  />
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <Image className="w-4 h-4" />
                <span>Add image or video</span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.content.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  '🚀 Post'
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}