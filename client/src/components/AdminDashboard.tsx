import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { trpc } from '@/utils/trpc';
import type { AdminStats } from '../../../server/src/schema';
import { 
  Users, 
  FileText, 
  Shield, 
  TrendingUp,
  UserCheck,
  GraduationCap,
  Building,
  Crown
} from 'lucide-react';

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const adminStats = await trpc.getAdminStats.query();
      setStats(adminStats);
    } catch (error) {
      console.error('Failed to load admin stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to load statistics</h3>
          <p className="text-gray-600">There was an error loading the admin dashboard data.</p>
        </CardContent>
      </Card>
    );
  }

  const totalUsers = stats.total_users;
  const rolePercentages = {
    admin: (stats.users_by_role.admin / totalUsers) * 100,
    teacher: (stats.users_by_role.teacher / totalUsers) * 100,
    student: (stats.users_by_role.student / totalUsers) * 100,
    alumni: (stats.users_by_role.alumni / totalUsers) * 100
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Total Users</p>
                <p className="text-3xl font-bold text-blue-900">{stats.total_users}</p>
              </div>
              <div className="bg-blue-500 p-3 rounded-full">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-blue-600">
              <TrendingUp className="w-3 h-3 mr-1" />
              Active community
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">Total Posts</p>
                <p className="text-3xl font-bold text-green-900">{stats.total_posts}</p>
              </div>
              <div className="bg-green-500 p-3 rounded-full">
                <FileText className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-green-600">
              <TrendingUp className="w-3 h-3 mr-1" />
              Content created
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium">Total Groups</p>
                <p className="text-3xl font-bold text-purple-900">{stats.total_groups}</p>
              </div>
              <div className="bg-purple-500 p-3 rounded-full">
                <Shield className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-purple-600">
              <TrendingUp className="w-3 h-3 mr-1" />
              Communities formed
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-600 text-sm font-medium">Active Today</p>
                <p className="text-3xl font-bold text-yellow-900">{stats.active_users_today}</p>
              </div>
              <div className="bg-yellow-500 p-3 rounded-full">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-yellow-600">
              <TrendingUp className="w-3 h-3 mr-1" />
              Daily engagement
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Roles Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>User Roles Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <GraduationCap className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">Students</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">{stats.users_by_role.student}</span>
                  <Badge className="bg-green-500 text-white">
                    {rolePercentages.student.toFixed(1)}%
                  </Badge>
                </div>
              </div>
              <Progress value={rolePercentages.student} className="h-2" />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Building className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">Teachers</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">{stats.users_by_role.teacher}</span>
                  <Badge className="bg-blue-500 text-white">
                    {rolePercentages.teacher.toFixed(1)}%
                  </Badge>
                </div>
              </div>
              <Progress value={rolePercentages.teacher} className="h-2" />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Crown className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">Alumni</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">{stats.users_by_role.alumni}</span>
                  <Badge className="bg-purple-500 text-white">
                    {rolePercentages.alumni.toFixed(1)}%
                  </Badge>
                </div>
              </div>
              <Progress value={rolePercentages.alumni} className="h-2" />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium">Admins</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">{stats.users_by_role.admin}</span>
                  <Badge className="bg-red-500 text-white">
                    {rolePercentages.admin.toFixed(1)}%
                  </Badge>
                </div>
              </div>
              <Progress value={rolePercentages.admin} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>Platform Health</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {((stats.active_users_today / stats.total_users) * 100).toFixed(1)}%
                </div>
                <p className="text-sm text-blue-700">Daily Active Rate</p>
              </div>

              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {(stats.total_posts / stats.total_users).toFixed(1)}
                </div>
                <p className="text-sm text-green-700">Posts per User</p>
              </div>

              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {(stats.total_groups / stats.total_users * 100).toFixed(1)}%
                </div>
                <p className="text-sm text-purple-700">Group Participation</p>
              </div>

              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {stats.total_users > 0 ? '100%' : '0%'}
                </div>
                <p className="text-sm text-yellow-700">Platform Health</p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">📊 Quick Stats</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Average engagement:</span>
                  <span className="font-medium">
                    {stats.active_users_today > 0 ? 'High' : 'Low'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Community size:</span>
                  <span className="font-medium">
                    {stats.total_users > 100 ? 'Large' : stats.total_users > 50 ? 'Medium' : 'Small'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Content activity:</span>
                  <span className="font-medium">
                    {stats.total_posts > 50 ? 'Active' : 'Moderate'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>Platform Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-2">👥</div>
              <h3 className="font-semibold text-gray-900 mb-1">Community</h3>
              <p className="text-sm text-gray-600">
                {stats.total_users} members across all roles building connections and sharing knowledge
              </p>
            </div>

            <div className="text-center">
              <div className="text-4xl mb-2">📚</div>
              <h3 className="font-semibold text-gray-900 mb-1">Content</h3>
              <p className="text-sm text-gray-600">
                {stats.total_posts} posts and {stats.total_groups} groups fostering engagement and collaboration
              </p>
            </div>

            <div className="text-center">
              <div className="text-4xl mb-2">📈</div>
              <h3 className="font-semibold text-gray-900 mb-1">Growth</h3>
              <p className="text-sm text-gray-600">
                {stats.active_users_today} active users today showing healthy platform engagement
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}