import { useEffect, useMemo, useState } from 'react';
import { getRecord, getRecords } from '../../lib/api';
import { formatRupiah } from '../../lib/format';
import { useI18n } from '../../contexts/I18nContext';

interface OrderGood {
  good_id?: string;
  name?: string;
  description?: string;
  unit?: string;
  qty: number;
  price: number;
}

interface SalesOrder {
  id: string;
  order_number: string;
  po_number?: string;
  project_name?: string;
  company_name?: string;
  goods?: OrderGood[] | string | null;
  created_at: string;
}

interface DeliveryOrder {
  id: string;
  sales_order_id: string;
  goods?: Array<{
    good_id?: string;
    name?: string;
    qty?: number;
  }> | string | null;
}

interface ProgressRow {
  name: string;
  unit: string;
  qty: number;
  price: number;
  subtotal: number;
  workload: number;
  delivered: number;
  remaining: number;
  progressValue: number;
  remainingValue: number;
  progressPercent: number;
}

const parseGoods = (goods?: OrderGood[] | string | null) => {
  if (!goods) return [];
  if (Array.isArray(goods)) return goods;
  try {
    return JSON.parse(goods) as OrderGood[];
  } catch {
    return [];
  }
};

const parseDeliveryGoods = (goods?: DeliveryOrder['goods']) => {
  if (!goods) return [];
  if (Array.isArray(goods)) return goods;
  try {
    return JSON.parse(goods) as DeliveryOrder['goods'];
  } catch {
    return [];
  }
};

const formatCurrency = (value: number) => `Rp ${formatRupiah(value)}`;

export default function OrderProgress({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const [orderData, deliveryData] = await Promise.all([
          getRecord<SalesOrder>('sales_orders', orderId),
          getRecords<DeliveryOrder>('delivery_orders'),
        ]);
        setOrder(orderData);
        setDeliveries(
          deliveryData.filter((delivery) => String(delivery.sales_order_id) === String(orderId))
        );
      } catch (error) {
        console.error('Failed to load progress data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
  }, [orderId]);

  const progressRows = useMemo(() => {
    if (!order) return [] as ProgressRow[];
    const orderGoods = parseGoods(order.goods);
    const shippedMap = new Map<string, number>();

    deliveries.forEach((delivery) => {
      const items = parseDeliveryGoods(delivery.goods) || [];
      items.forEach((item) => {
        const key = item?.good_id ? `id:${item.good_id}` : `name:${item?.name || ''}`;
        const current = shippedMap.get(key) || 0;
        shippedMap.set(key, current + (Number(item?.qty) || 0));
      });
    });

    const totalSubtotal = orderGoods.reduce(
      (sum, row) => sum + (Number(row.qty) || 0) * (Number(row.price) || 0),
      0
    );

    return orderGoods.map((row) => {
      const key = row.good_id ? `id:${row.good_id}` : `name:${row.name || ''}`;
      const orderedQty = Number(row.qty) || 0;
      const deliveredQty = Math.min(shippedMap.get(key) || 0, orderedQty);
      const remainingQty = Math.max(orderedQty - deliveredQty, 0);
      const subtotal = orderedQty * (Number(row.price) || 0);
      const workload = totalSubtotal > 0 ? (subtotal / totalSubtotal) * 100 : 0;
      const progressValue = deliveredQty * (Number(row.price) || 0);
      const remainingValue = remainingQty * (Number(row.price) || 0);
      const progressPercent = orderedQty > 0 ? (deliveredQty / orderedQty) * 100 : 0;

      return {
        name: row.name || '- ',
        unit: row.unit || '-',
        qty: orderedQty,
        price: Number(row.price) || 0,
        subtotal,
        workload,
        delivered: deliveredQty,
        remaining: remainingQty,
        progressValue,
        remainingValue,
        progressPercent,
      };
    });
  }, [order, deliveries]);

  const totals = useMemo(() => {
    return progressRows.reduce(
      (acc, row) => {
        acc.subtotal += row.subtotal;
        acc.progressValue += row.progressValue;
        acc.remainingValue += row.remainingValue;
        acc.delivered += row.delivered;
        acc.qty += row.qty;
        return acc;
      },
      {
        subtotal: 0,
        progressValue: 0,
        remainingValue: 0,
        delivered: 0,
        qty: 0,
      }
    );
  }, [progressRows]);

  const overallProgress = totals.qty > 0 ? (totals.delivered / totals.qty) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">{t('Loading progress...')}</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">{t('Sales order not found.')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('Order Progress')}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {order.po_number || order.order_number} · {order.project_name || t('Project')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">{t('Overall Progress')}</p>
              <p className="text-lg font-semibold text-gray-900">{overallProgress.toFixed(1)}%</p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <div className="h-2 w-full rounded-full bg-gray-100">
              <div
                className="h-2 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(overallProgress, 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Company</p>
                <p className="font-medium text-gray-900">{order.company_name || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Total Delivered</p>
                <p className="font-medium text-gray-900">
                  {totals.delivered} / {totals.qty} items
                </p>
              </div>
              <div>
                <p className="text-gray-500">Delivered Value</p>
                <p className="font-medium text-gray-900">{formatCurrency(totals.progressValue)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">No</th>
                  <th className="px-3 py-2 text-left">Material</th>
                  <th className="px-3 py-2 text-left">Unit</th>
                  <th className="px-3 py-2 text-left">Ordered</th>
                  <th className="px-3 py-2 text-left">Delivered</th>
                  <th className="px-3 py-2 text-left">Remaining</th>
                  <th className="px-3 py-2 text-left">Progress</th>
                  <th className="px-3 py-2 text-left">Workload</th>
                  <th className="px-3 py-2 text-left">Subtotal</th>
                  <th className="px-3 py-2 text-left">Progress Value</th>
                  <th className="px-3 py-2 text-left">Remaining Value</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {progressRows.map((row, index) => (
                  <tr key={`${row.name}-${index}`} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                    <td className="px-3 py-2">{index + 1}</td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">{row.unit}</td>
                    <td className="px-3 py-2">{row.qty}</td>
                    <td className="px-3 py-2">{row.delivered}</td>
                    <td className="px-3 py-2">{row.remaining}</td>
                    <td className="px-3 py-2 min-w-[160px]">
                      <div className="space-y-1">
                        <div className="h-2 w-full rounded-full bg-gray-100">
                          <div
                            className="h-2 rounded-full bg-emerald-500"
                            style={{ width: `${Math.min(row.progressPercent, 100)}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500">{row.progressPercent.toFixed(1)}%</div>
                      </div>
                    </td>
                    <td className="px-3 py-2">{row.workload.toFixed(2)}%</td>
                    <td className="px-3 py-2">{formatCurrency(row.subtotal)}</td>
                    <td className="px-3 py-2">{formatCurrency(row.progressValue)}</td>
                    <td className="px-3 py-2">{formatCurrency(row.remainingValue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-3 py-2 font-semibold" colSpan={5}>
                    Total
                  </td>
                  <td className="px-3 py-2 font-semibold">{totals.qty - totals.delivered}</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 font-semibold">{formatCurrency(totals.subtotal)}</td>
                  <td className="px-3 py-2 font-semibold">{formatCurrency(totals.progressValue)}</td>
                  <td className="px-3 py-2 font-semibold">{formatCurrency(totals.remainingValue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
