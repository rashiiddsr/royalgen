import { useAuth } from '../../contexts/AuthContext';
import { Users, Package, FileText, Receipt, TrendingUp, ArrowUpRight } from 'lucide-react';

export default function DashboardHome() {
  const { profile } = useAuth();

  const stats = [
    {
      name: 'Total Suppliers',
      value: '0',
      icon: Users,
      gradient: 'from-blue-500 to-cyan-500',
      bgGradient: 'from-blue-50 to-cyan-50'
    },
    {
      name: 'Total Goods',
      value: '0',
      icon: Package,
      gradient: 'from-emerald-500 to-teal-500',
      bgGradient: 'from-emerald-50 to-teal-50'
    },
    {
      name: 'Active RFQs',
      value: '0',
      icon: FileText,
      gradient: 'from-amber-500 to-orange-500',
      bgGradient: 'from-amber-50 to-orange-50'
    },
    {
      name: 'Pending Invoices',
      value: '0',
      icon: Receipt,
      gradient: 'from-rose-500 to-pink-500',
      bgGradient: 'from-rose-50 to-pink-50'
    },
  ];

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent mb-3">
          Welcome back, {profile?.full_name || 'User'}!
        </h1>
        <p className="text-gray-600 text-lg font-medium">
          Here's what's happening with your procurement today.
        </p>
      </div>

      <div className="mb-10 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-amber-900 shadow-sm">
        <p className="text-sm font-semibold">Dashboard data is temporarily unavailable.</p>
        <p className="text-sm mt-2">Use the navigation menu to continue working.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.name}
              className={`bg-gradient-to-br ${stat.bgGradient} rounded-2xl shadow-lg border border-white/50 p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 backdrop-blur-sm`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`bg-gradient-to-br ${stat.gradient} p-3 rounded-xl shadow-lg`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <TrendingUp className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-4xl font-bold text-gray-900 mb-2">{stat.value}</p>
              <p className="text-sm text-gray-700 font-semibold">{stat.name}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-8 hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Recent Activity</h2>
            <ArrowUpRight className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            <div className="flex items-center p-4 bg-gray-50 rounded-xl">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
              <p className="text-gray-600 text-sm font-medium">No recent activity to display.</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-emerald-500 rounded-2xl shadow-xl border border-white/50 p-8 text-white hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]">
          <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <p className="text-white/90 font-medium leading-relaxed">
              Use the navigation menu to access different modules based on your role.
            </p>
            <div className="pt-4">
              <div className="flex items-center space-x-2 text-white/80">
                <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Package className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">Manage Inventory</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
