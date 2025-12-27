import { useAuth } from '../../contexts/AuthContext';
import { Users, Package, FileText, Receipt, TrendingUp, ArrowUpRight, BarChart3, LineChart } from 'lucide-react';

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
  const rfqTrend = [12, 18, 9, 24, 30, 22, 28];
  const quotationConversion = [20, 24, 22, 28, 35, 32];
  const pipelineStages = [
    { label: 'Waiting', value: 18, color: 'bg-amber-400' },
    { label: 'Negotiation', value: 26, color: 'bg-blue-500' },
    { label: 'Process', value: 14, color: 'bg-emerald-500' },
    { label: 'Success', value: 9, color: 'bg-emerald-600' },
  ];

  const maxRfq = Math.max(...rfqTrend, 1);
  const maxConversion = Math.max(...quotationConversion, 1);

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

      <div className="mb-10 rounded-2xl border border-blue-200 bg-blue-50 px-6 py-5 text-blue-900 shadow-sm">
        <p className="text-sm font-semibold">Live insights snapshot</p>
        <p className="text-sm mt-2">
          Track RFQs, quotations, and order progress in one place while deeper analytics roll out.
        </p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6 hover:shadow-2xl transition-all duration-300 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Weekly RFQ Trend</h2>
              <p className="text-sm text-gray-600">Last 7 days requests overview</p>
            </div>
            <LineChart className="h-5 w-5 text-gray-400" />
          </div>
          <div className="h-40 w-full">
            <svg viewBox="0 0 100 40" className="h-full w-full">
              <polyline
                fill="none"
                stroke="#2563eb"
                strokeWidth="2"
                points={rfqTrend
                  .map((value, index) => {
                    const x = (index / (rfqTrend.length - 1)) * 100;
                    const y = 40 - (value / maxRfq) * 32 - 4;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
              {rfqTrend.map((value, index) => {
                const x = (index / (rfqTrend.length - 1)) * 100;
                const y = 40 - (value / maxRfq) * 32 - 4;
                return <circle key={value + index} cx={x} cy={y} r="1.5" fill="#2563eb" />;
              })}
            </svg>
          </div>
          <div className="mt-4 grid grid-cols-7 text-xs text-gray-500">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
              <span key={label} className="text-center">
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-white/50 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Quotation Pipeline</h2>
              <p className="text-xs text-gray-500">Current stage distribution</p>
            </div>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {pipelineStages.map((stage) => (
              <div key={stage.label}>
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>{stage.label}</span>
                  <span>{stage.value}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`${stage.color} h-full`} style={{ width: `${stage.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-8 hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Quotation Conversion</h2>
              <p className="text-sm text-gray-600">Trend from negotiation to success</p>
            </div>
            <ArrowUpRight className="h-5 w-5 text-gray-400" />
          </div>
          <div className="flex items-end gap-3 h-40">
            {quotationConversion.map((value, index) => (
              <div key={`${value}-${index}`} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-xl bg-blue-100"
                  style={{ height: `${(value / maxConversion) * 100}%` }}
                >
                  <div className="w-full h-full rounded-xl bg-blue-500 opacity-80" />
                </div>
                <span className="text-xs text-gray-500">W{index + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-emerald-500 rounded-2xl shadow-xl border border-white/50 p-8 text-white hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]">
          <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <p className="text-white/90 font-medium leading-relaxed">
              Use the navigation menu to access different modules based on your role.
            </p>
            <div className="pt-4 grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-2 text-white/80">
                <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Package className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">Inventory</span>
              </div>
              <div className="flex items-center space-x-2 text-white/80">
                <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <FileText className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">RFQs</span>
              </div>
              <div className="flex items-center space-x-2 text-white/80">
                <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Receipt className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">Invoices</span>
              </div>
              <div className="flex items-center space-x-2 text-white/80">
                <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">Orders</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
