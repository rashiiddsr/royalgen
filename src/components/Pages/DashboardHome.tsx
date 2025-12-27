import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Package, FileText, Receipt, TrendingUp, ArrowUpRight, BarChart3, LineChart } from 'lucide-react';
import { getRecords } from '../../lib/api';
import { formatRupiah } from '../../lib/format';

interface Supplier {
  id: string | number;
  status?: string | null;
}

interface Good {
  id: string | number;
  status?: string | null;
}

interface RFQ {
  id: string | number;
  status: string;
  created_at: string;
}

interface Quotation {
  id: string | number;
  status: string;
  created_at: string;
}

interface Invoice {
  id: string | number;
  invoice_number: string;
  company_name?: string | null;
  status: string;
  grand_total?: number | null;
  created_at: string;
}

export default function DashboardHome() {
  const { profile } = useAuth();
  const [suppliersCount, setSuppliersCount] = useState(0);
  const [goodsCount, setGoodsCount] = useState(0);
  const [activeRfqsCount, setActiveRfqsCount] = useState(0);
  const [pendingInvoicesCount, setPendingInvoicesCount] = useState(0);
  const [rfqTrend, setRfqTrend] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [quotationConversion, setQuotationConversion] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [pipelineStages, setPipelineStages] = useState([
    { label: 'Waiting', value: 0, color: 'bg-amber-400' },
    { label: 'Negotiation', value: 0, color: 'bg-blue-500' },
    { label: 'Process', value: 0, color: 'bg-emerald-500' },
    { label: 'Success', value: 0, color: 'bg-emerald-600' },
  ]);
  const [invoiceSnapshot, setInvoiceSnapshot] = useState([
    { label: 'Awaiting Payment', value: 0, amount: 'Rp 0' },
    { label: 'Overdue', value: 0, amount: 'Rp 0' },
    { label: 'Paid Today', value: 0, amount: 'Rp 0' },
  ]);
  const [recentInvoices, setRecentInvoices] = useState<
    { invoice: string; company: string; status: string; amount: string }[]
  >([]);

  const handleQuickAction = (page: string) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('app:navigate', { detail: page }));
  };

  useEffect(() => {
    let isMounted = true;
    const getDayKey = (date: Date) => date.toISOString().split('T')[0];
    const fetchDashboardData = async () => {
      try {
        const [suppliers, goods, rfqs, quotations, invoices] = await Promise.all([
          getRecords<Supplier>('suppliers'),
          getRecords<Good>('goods'),
          getRecords<RFQ>('rfqs'),
          getRecords<Quotation>('quotations'),
          getRecords<Invoice>('invoices'),
        ]);
        if (!isMounted) return;

        setSuppliersCount(suppliers.length);
        setGoodsCount(goods.length);
        setActiveRfqsCount(
          rfqs.filter((rfq) => ['draft', 'process'].includes(rfq.status)).length
        );
        setPendingInvoicesCount(
          invoices.filter((invoice) => invoice.status !== 'paid').length
        );

        const today = new Date();
        const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
          const date = new Date(today);
          date.setDate(today.getDate() - (6 - index));
          return getDayKey(date);
        });
        const rfqByDay = rfqs.reduce<Record<string, number>>((acc, rfq) => {
          const key = getDayKey(new Date(rfq.created_at));
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});
        setRfqTrend(lastSevenDays.map((day) => rfqByDay[day] || 0));

        const lastSixWeeks = Array.from({ length: 6 }, (_, index) => {
          const start = new Date(today);
          start.setDate(today.getDate() - (5 - index) * 7);
          return getDayKey(start);
        });
        const conversionByWeek = lastSixWeeks.map((weekStart) => {
          const weekStartDate = new Date(weekStart);
          const weekEnd = new Date(weekStartDate);
          weekEnd.setDate(weekStartDate.getDate() + 6);
          return quotations.filter((quotation) => {
            const createdAt = new Date(quotation.created_at);
            return createdAt >= weekStartDate && createdAt <= weekEnd;
          }).length;
        });
        setQuotationConversion(conversionByWeek);

        const statusCounts = quotations.reduce<Record<string, number>>((acc, quotation) => {
          const status = quotation.status || 'waiting';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});
        setPipelineStages([
          { label: 'Waiting', value: statusCounts.waiting || 0, color: 'bg-amber-400' },
          { label: 'Negotiation', value: statusCounts.negotiation || 0, color: 'bg-blue-500' },
          { label: 'Process', value: statusCounts.process || 0, color: 'bg-emerald-500' },
          { label: 'Success', value: statusCounts.success || 0, color: 'bg-emerald-600' },
        ]);

        const awaiting = invoices.filter((invoice) => invoice.status === 'waiting payment');
        const overdue = invoices.filter((invoice) => invoice.status === 'overdue');
        const paidToday = invoices.filter((invoice) => {
          if (invoice.status !== 'paid') return false;
          return getDayKey(new Date(invoice.created_at)) === getDayKey(today);
        });

        const sumAmount = (items: Invoice[]) =>
          items.reduce((sum, invoice) => sum + (Number(invoice.grand_total) || 0), 0);

        setInvoiceSnapshot([
          {
            label: 'Awaiting Payment',
            value: awaiting.length,
            amount: `Rp ${formatRupiah(sumAmount(awaiting))}`,
          },
          {
            label: 'Overdue',
            value: overdue.length,
            amount: `Rp ${formatRupiah(sumAmount(overdue))}`,
          },
          {
            label: 'Paid Today',
            value: paidToday.length,
            amount: `Rp ${formatRupiah(sumAmount(paidToday))}`,
          },
        ]);

        const sortedInvoices = [...invoices].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setRecentInvoices(
          sortedInvoices.slice(0, 6).map((invoice) => ({
            invoice: invoice.invoice_number,
            company: invoice.company_name || '-',
            status: invoice.status,
            amount: `Rp ${formatRupiah(Number(invoice.grand_total) || 0)}`,
          }))
        );
      } catch (error) {
        console.error('Failed to load dashboard data', error);
      }
    };

    fetchDashboardData();
    const interval = window.setInterval(fetchDashboardData, 60000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const stats = [
    {
      name: 'Total Suppliers',
      value: String(suppliersCount),
      icon: Users,
      gradient: 'from-blue-500 to-cyan-500',
      bgGradient: 'from-blue-50 to-cyan-50'
    },
    {
      name: 'Total Goods',
      value: String(goodsCount),
      icon: Package,
      gradient: 'from-emerald-500 to-teal-500',
      bgGradient: 'from-emerald-50 to-teal-50'
    },
    {
      name: 'Active RFQs',
      value: String(activeRfqsCount),
      icon: FileText,
      gradient: 'from-amber-500 to-orange-500',
      bgGradient: 'from-amber-50 to-orange-50'
    },
    {
      name: 'Pending Invoices',
      value: String(pendingInvoicesCount),
      icon: Receipt,
      gradient: 'from-rose-500 to-pink-500',
      bgGradient: 'from-rose-50 to-pink-50'
    },
  ];

  const maxRfq = Math.max(...rfqTrend, 1);
  const maxConversion = Math.max(...quotationConversion, 1);
  const dayLabels = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    });
  }, []);

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

      <div className="mb-10 rounded-2xl border border-blue-200 bg-blue-50 px-6 py-5 text-blue-900 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100">
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
              className={`bg-gradient-to-br ${stat.bgGradient} rounded-2xl shadow-lg border border-white/50 p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 backdrop-blur-sm dark:from-slate-900 dark:to-slate-800 dark:border-slate-700`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`bg-gradient-to-br ${stat.gradient} p-3 rounded-xl shadow-lg`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <TrendingUp className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-4xl font-bold text-gray-900 mb-2 dark:text-white">{stat.value}</p>
              <p className="text-sm text-gray-700 font-semibold dark:text-slate-300">{stat.name}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6 hover:shadow-2xl transition-all duration-300 lg:col-span-2 dark:bg-slate-900/80 dark:border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Weekly RFQ Trend</h2>
              <p className="text-sm text-gray-600 dark:text-slate-400">Last 7 days requests overview</p>
            </div>
            <LineChart className="h-5 w-5 text-gray-400" />
          </div>
          <div className="h-40 w-full">
            <svg viewBox="0 0 100 40" className="h-full w-full">
              <polyline
                fill="none"
                stroke="#3b82f6"
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
                return <circle key={value + index} cx={x} cy={y} r="1.5" fill="#3b82f6" />;
              })}
            </svg>
          </div>
          <div className="mt-4 grid grid-cols-7 text-xs text-gray-500 dark:text-slate-500">
            {dayLabels.map((label) => (
              <span key={label} className="text-center">
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-white/50 p-6 dark:bg-slate-900/80 dark:border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Quotation Pipeline</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">Current stage distribution</p>
            </div>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {pipelineStages.map((stage) => (
              <div key={stage.label}>
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1 dark:text-slate-400">
                  <span>{stage.label}</span>
                  <span>{stage.value}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden dark:bg-slate-800">
                  <div className={`${stage.color} h-full`} style={{ width: `${stage.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-8 hover:shadow-2xl transition-all duration-300 dark:bg-slate-900/80 dark:border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Quotation Conversion</h2>
              <p className="text-sm text-gray-600 dark:text-slate-400">Trend from negotiation to success</p>
            </div>
            <ArrowUpRight className="h-5 w-5 text-gray-400" />
          </div>
          <div className="flex items-end gap-3 h-40">
            {quotationConversion.map((value, index) => (
              <div key={`${value}-${index}`} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-xl bg-blue-100 dark:bg-slate-800"
                  style={{ height: `${(value / maxConversion) * 100}%` }}
                >
                  <div className="w-full h-full rounded-xl bg-blue-500 opacity-80" />
                </div>
                <span className="text-xs text-gray-500 dark:text-slate-500">W{index + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-8 hover:shadow-2xl transition-all duration-300 dark:bg-slate-900/80 dark:border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Invoice Snapshot</h2>
              <p className="text-sm text-gray-600 dark:text-slate-400">Monitor invoice exposure</p>
            </div>
            <Receipt className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {invoiceSnapshot.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white/70 px-4 py-3 text-sm text-gray-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200"
              >
                <div>
                  <p className="font-semibold">{item.label}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-500">{item.value} invoices</p>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.amount}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-8 hover:shadow-2xl transition-all duration-300 lg:col-span-2 dark:bg-slate-900/80 dark:border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Recent Invoices</h2>
              <p className="text-sm text-gray-600 dark:text-slate-400">Latest billing activity</p>
            </div>
            <ArrowUpRight className="h-5 w-5 text-gray-400" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-gray-500 dark:text-slate-400">
                <tr>
                  <th className="pb-3 text-left">Invoice</th>
                  <th className="pb-3 text-left">Company</th>
                  <th className="pb-3 text-left">Status</th>
                  <th className="pb-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {recentInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-gray-500 dark:text-slate-400">
                      No invoices available yet.
                    </td>
                  </tr>
                ) : (
                  recentInvoices.map((invoice) => (
                    <tr key={invoice.invoice}>
                      <td className="py-3 font-semibold text-gray-900 dark:text-white">{invoice.invoice}</td>
                      <td className="py-3 text-gray-600 dark:text-slate-300">{invoice.company}</td>
                      <td className="py-3">
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                          {invoice.status}
                        </span>
                      </td>
                      <td className="py-3 text-right font-semibold text-gray-900 dark:text-white">{invoice.amount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-emerald-500 rounded-2xl shadow-xl border border-white/50 p-8 text-white hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]">
          <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <p className="text-white/90 font-medium leading-relaxed">
              Jump directly to a module for fast updates.
            </p>
            <div className="pt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleQuickAction('goods')}
                className="flex items-center space-x-2 text-white/90 rounded-lg border border-white/20 px-3 py-2 hover:bg-white/10"
              >
                <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Package className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">Inventory</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('rfq')}
                className="flex items-center space-x-2 text-white/90 rounded-lg border border-white/20 px-3 py-2 hover:bg-white/10"
              >
                <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <FileText className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">RFQs</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('invoices')}
                className="flex items-center space-x-2 text-white/90 rounded-lg border border-white/20 px-3 py-2 hover:bg-white/10"
              >
                <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Receipt className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">Invoices</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('orders')}
                className="flex items-center space-x-2 text-white/90 rounded-lg border border-white/20 px-3 py-2 hover:bg-white/10"
              >
                <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">Orders</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
