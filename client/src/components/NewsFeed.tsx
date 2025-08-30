import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PostComments } from '@/components/PostComments';
import { trpc } from '@/utils/trpc';
import type { User, PostWithAuthor } from '../../../server/src/schema';
import { 
  Heart, 
  MessageCircle, 
  Share, 
  MoreHorizontal,
  Trash2,
  Clock,
  Play
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NewsFeedProps {
  currentUser: User;
}

export function NewsFeed({ currentUser }: NewsFeedProps) {
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());

  const loadFeed = useCallback(async () => {
    try {
      setLoading(true);
      const feedPosts = await trpc.getNewsFeed.query({ 
        userId: currentUser.id,
        offset: 0,
        limit: 20
      });
      setPosts(feedPosts);
      // Track which posts are already liked
      const liked = new Set(
        feedPosts.filter((post: PostWithAuthor) => post.is_liked).map((post: PostWithAuthor) => post.id)
      );
      setLikedPosts(liked);
    } catch (error) {
      console.error('Failed to load feed:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const handleLike = async (postId: number, isLiked: boolean) => {
    try {
      if (isLiked) {
        await trpc.unlikePost.mutate({ postId, userId: currentUser.id });
        setLikedPosts((prev: Set<number>) => {
          const newSet = new Set(prev);
          newSet.delete(postId);
          return newSet;
        });
      } else {
        await trpc.likePost.mutate({ post_id: postId, userId: currentUser.id });
        setLikedPosts((prev: Set<number>) => new Set([...prev, postId]));
      }

      // Update post likes count
      setPosts((prev: PostWithAuthor[]) =>
        prev.map((post: PostWithAuthor) =>
          post.id === postId
            ? {
                ...post,
                likes_count: isLiked ? post.likes_count - 1 : post.likes_count + 1,
                is_liked: !isLiked
              }
            : post
        )
      );
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  const handleDelete = async (postId: number) => {
    try {
      await trpc.deletePost.mutate({ 
        postId, 
        userId: currentUser.id, 
        isAdmin: currentUser.role === 'admin' 
      });
      setPosts((prev: PostWithAuthor[]) => prev.filter((post: PostWithAuthor) => post.id !== postId));
    } catch (error) {
      console.error('Failed to delete post:', error);
    }
  };

  const toggleComments = (postId: number) => {
    setExpandedComments((prev: Set<number>) => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
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

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="w-full">
            <CardHeader className="animate-pulse">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/6"></div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="animate-pulse">
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No posts yet!</h3>
          <p className="text-gray-600">Be the first to share something with your school community.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {posts.map((post: PostWithAuthor) => {
        const isLiked = likedPosts.has(post.id);
        const canDelete = post.author_id === currentUser.id || currentUser.role === 'admin';
        
        return (
          <Card key={post.id} className="w-full hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={post.author_profile_picture || undefined} />
                    <AvatarFallback>
                      {post.author_first_name[0]}{post.author_last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-gray-900">
                        {post.author_first_name} {post.author_last_name}
                      </h3>
                      <Badge 
                        className={`${getRoleBadgeColor('student')} text-white text-xs`}
                        variant="secondary"
                      >
                        Student
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-1 text-sm text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeAgo(post.created_at)}</span>
                    </div>
                  </div>
                </div>

                {canDelete && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleDelete(post.id)}
                        className="text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Post
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <p className="text-gray-900 whitespace-pre-wrap">{post.content}</p>

              {post.image_url && (
                <div className="rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={post.image_url}
                    alt="Post image"
                    className="w-full h-auto max-h-96 object-cover"
                    loading="lazy"
                  />
                </div>
              )}

              {post.video_url && (
                <div className="rounded-lg overflow-hidden bg-gray-900 relative">
                  <video
                    src={post.video_url}
                    controls
                    className="w-full h-auto max-h-96"
                    preload="metadata"
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Play className="w-12 h-12 text-white opacity-70" />
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleLike(post.id, isLiked)}
                    className={`hover:bg-red-50 ${isLiked ? 'text-red-500' : 'text-gray-500'}`}
                  >
                    <Heart className={`w-4 h-4 mr-2 ${isLiked ? 'fill-current' : ''}`} />
                    {post.likes_count}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleComments(post.id)}
                    className="text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    {post.comments_count}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 hover:bg-green-50 hover:text-green-600"
                  >
                    <Share className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                </div>
              </div>

              {expandedComments.has(post.id) && (
                <div className="pt-4 border-t">
                  <PostComments
                    postId={post.id}
                    currentUser={currentUser}
                    onCommentAdded={() => {
                      // Update comments count
                      setPosts((prev: PostWithAuthor[]) =>
                        prev.map((p: PostWithAuthor) =>
                          p.id === post.id
                            ? { ...p, comments_count: p.comments_count + 1 }
                            : p
                        )
                      );
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}