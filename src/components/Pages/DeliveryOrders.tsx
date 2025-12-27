import { useEffect, useMemo, useState } from 'react';
import { Eye, Plus, Search, Truck, X } from 'lucide-react';
import { addRecord, getRecords } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';

interface DeliveryGood {
  good_id?: string;
  name?: string;
  description?: string;
  unit?: string;
  qty: number | '';
  remaining_qty?: number;
}

interface DeliveryOrder {
  id: string;
  delivery_number: string;
  delivery_date: string;
  sales_order_id: string;
  company_name?: string;
  goods?: DeliveryGood[] | string | null;
  created_by?: number | null;
  created_at: string;
}

interface SalesOrderGood {
  good_id?: string;
  name?: string;
  description?: string;
  unit?: string;
  qty: number;
}

interface SalesOrder {
  id: string;
  order_number: string;
  po_number?: string;
  company_name?: string;
  goods?: SalesOrderGood[] | string | null;
  status: string;
}

const EMPTY_FORM = {
  delivery_number: '',
  delivery_date: '',
  sales_order_id: '',
  company_name: '',
};

export default function DeliveryOrders() {
  const { profile } = useAuth();
  const { pushNotification } = useNotifications();
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [goodsRows, setGoodsRows] = useState<DeliveryGood[]>([]);
  const [usersById, setUsersById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [detailDelivery, setDetailDelivery] = useState<DeliveryOrder | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const parseGoods = (goods?: SalesOrderGood[] | DeliveryGood[] | string | null) => {
    if (!goods) return [];
    if (Array.isArray(goods)) return goods;
    if (typeof goods === 'string') {
      try {
        return JSON.parse(goods);
      } catch {
        return [];
      }
    }
    return [];
  };

  const fetchData = async () => {
    try {
      const [deliveryData, orderData, userData] = await Promise.all([
        getRecords<DeliveryOrder>('delivery_orders'),
        getRecords<SalesOrder>('sales_orders'),
        getRecords<{ id: string; full_name?: string; email?: string }>('users'),
      ]);

      const userMap = userData.reduce<Record<string, string>>((acc, user) => {
        const name = user.full_name || user.email || 'User';
        acc[String(user.id)] = name;
        return acc;
      }, {});

      const mappedDeliveries = deliveryData
        .map((delivery) => ({
          ...delivery,
          goods: parseGoods(delivery.goods),
        }))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const mappedOrders = orderData.map((order) => ({
        ...order,
        goods: parseGoods(order.goods),
      }));

      setDeliveries(mappedDeliveries);
      setSalesOrders(mappedOrders);
      setUsersById(userMap);
    } catch (error) {
      console.error('Error fetching delivery orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNextDeliveryNumber = () => {
    const year = new Date().getFullYear();
    const romanMonths = [
      'I',
      'II',
      'III',
      'IV',
      'V',
      'VI',
      'VII',
      'VIII',
      'IX',
      'X',
      'XI',
      'XII',
    ];
    const romanMonth = romanMonths[new Date().getMonth()];
    const maxSequence = deliveries.reduce((max, delivery) => {
      const match = delivery.delivery_number?.match(/^(\d{4})\/RGI\/DO\/[IVXLCDM]+\/(\d{4})$/);
      if (!match || Number(match[2]) !== year) return max;
      const sequence = Number(match[1]);
      return Number.isNaN(sequence) ? max : Math.max(max, sequence);
    }, 0);
    const nextSequence = String(maxSequence + 1).padStart(4, '0');
    return `${nextSequence}/RGI/DO/${romanMonth}/${year}`;
  };

  const openCreateModal = () => {
    setFormData({
      ...EMPTY_FORM,
      delivery_number: getNextDeliveryNumber(),
    });
    setGoodsRows([]);
    setShowModal(true);
  };

  const buildShippedMap = (orderId: string) => {
    const shippedMap: Record<string, number> = {};
    deliveries
      .filter((delivery) => String(delivery.sales_order_id) === String(orderId))
      .forEach((delivery) => {
        parseGoods(delivery.goods).forEach((item) => {
          const key = item.good_id ? `id:${item.good_id}` : `name:${item.name}`;
          shippedMap[key] = (shippedMap[key] || 0) + (Number(item.qty) || 0);
        });
      });
    return shippedMap;
  };

  const handleSalesOrderChange = (salesOrderId: string) => {
    const order = salesOrders.find((item) => String(item.id) === String(salesOrderId));
    const shippedMap = salesOrderId ? buildShippedMap(salesOrderId) : {};
    const remainingGoods = parseGoods(order?.goods).map((item) => {
      const key = item.good_id ? `id:${item.good_id}` : `name:${item.name}`;
      const orderedQty = Number(item.qty) || 0;
      const shippedQty = shippedMap[key] || 0;
      const remaining = Math.max(orderedQty - shippedQty, 0);
      return {
        ...item,
        remaining_qty: remaining,
        qty: '',
      };
    });
    const filteredRemaining = remainingGoods.filter((item) => (item.remaining_qty ?? 0) > 0);

    setFormData((prev) => ({
      ...prev,
      sales_order_id: salesOrderId,
      company_name: order?.company_name || '',
    }));
    setGoodsRows(filteredRemaining);
  };

  const handleGoodsQtyChange = (index: number, value: string) => {
    setGoodsRows((prev) =>
      prev.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const qty = value === '' ? '' : Number(value);
        return { ...row, qty };
      })
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const confirmed = window.confirm(
      'Delivery orders cannot be edited after saving. Do you want to continue?'
    );
    if (!confirmed) return;

    if (!formData.delivery_date) {
      alert('Tanggal delivery wajib diisi.');
      return;
    }

    if (!formData.sales_order_id) {
      alert('Pilih sales order terlebih dahulu.');
      return;
    }

    const payloadGoods = goodsRows
      .filter((row) => Number(row.qty) > 0)
      .map((row) => ({
        good_id: row.good_id,
        name: row.name,
        description: row.description,
        unit: row.unit,
        qty: Number(row.qty) || 0,
      }));

    if (payloadGoods.length === 0) {
      alert('Masukkan qty pengiriman untuk minimal satu barang.');
      return;
    }

    const invalidQty = goodsRows.find((row) => {
      if (row.qty === '' || row.qty === null || row.qty === undefined) return false;
      const maxQty = Number(row.remaining_qty) || 0;
      return Number(row.qty) > maxQty;
    });
    if (invalidQty) {
      alert('Qty pengiriman tidak boleh melebihi sisa pesanan.');
      return;
    }

    try {
      await addRecord<DeliveryOrder>('delivery_orders', {
        delivery_number: formData.delivery_number,
        delivery_date: formData.delivery_date,
        sales_order_id: formData.sales_order_id,
        company_name: formData.company_name,
        goods: payloadGoods,
        created_by: profile?.id,
      });
      pushNotification({
        title: 'Delivery order created',
        message: `${formData.delivery_number} has been created.`,
      });
      setShowModal(false);
      setFormData(EMPTY_FORM);
      await fetchData();
    } catch (error) {
      console.error('Failed to create delivery order', error);
      alert('Failed to create delivery order. Please try again.');
    }
  };

  const openDetail = (delivery: DeliveryOrder) => {
    setDetailDelivery(delivery);
  };

  const orderMap = useMemo(
    () => new Map(salesOrders.map((order) => [String(order.id), order])),
    [salesOrders]
  );

  const filteredOrders = salesOrders.filter(
    (order) => order.status === 'ongoing' || order.status === 'on-delivery'
  );

  const filteredDeliveries = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return deliveries;
    return deliveries.filter((delivery) => {
      const order = orderMap.get(String(delivery.sales_order_id));
      return (
        delivery.delivery_number?.toLowerCase().includes(query) ||
        delivery.company_name?.toLowerCase().includes(query) ||
        order?.order_number?.toLowerCase().includes(query) ||
        order?.po_number?.toLowerCase().includes(query) ||
        usersById[String(delivery.created_by)]?.toLowerCase().includes(query)
      );
    });
  }, [deliveries, orderMap, searchTerm, usersById]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Delivery Orders</h1>
          <p className="text-gray-600 mt-1">Create and track delivery orders</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Delivery Order
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search delivery orders by number, sales order, company, or creator..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Delivery No
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sales Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created By
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No delivery orders found.</p>
                  </td>
                </tr>
              ) : (
                filteredDeliveries.map((delivery) => {
                  const order = orderMap.get(String(delivery.sales_order_id));
                  return (
                    <tr key={delivery.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {delivery.delivery_number}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {delivery.delivery_date || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {order?.po_number || order?.order_number || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {delivery.company_name || order?.company_name || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {delivery.created_by ? usersById[String(delivery.created_by)] || '-' : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openDetail(delivery)}
                          className="inline-flex items-center p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          aria-label="View delivery order"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-5xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <p className="text-sm text-gray-500 font-semibold uppercase">Delivery Order</p>
                <h2 className="text-xl font-bold text-gray-900">Create Delivery Order</h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition"
                aria-label="Close delivery order modal"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Number
                  </label>
                  <input
                    type="text"
                    value={formData.delivery_number}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.delivery_date}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, delivery_date: event.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sales Order <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.sales_order_id}
                    onChange={(event) => handleSalesOrderChange(event.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Select sales order</option>
                    {filteredOrders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.po_number || order.order_number}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <input
                    type="text"
                    value={formData.company_name}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Goods to Deliver</h3>
                {goodsRows.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Select a sales order to load remaining goods for delivery.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="px-3 py-2 text-left">Goods</th>
                          <th className="px-3 py-2 text-left">Description</th>
                          <th className="px-3 py-2 text-left">Unit</th>
                          <th className="px-3 py-2 text-left">Remaining Qty</th>
                          <th className="px-3 py-2 text-left">
                            Qty to Deliver <span className="text-red-500">*</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {goodsRows.map((row, index) => (
                          <tr key={`${row.good_id || row.name}-${index}`}>
                            <td className="px-3 py-2">{row.name || '-'}</td>
                            <td className="px-3 py-2">{row.description || '-'}</td>
                            <td className="px-3 py-2">{row.unit || '-'}</td>
                            <td className="px-3 py-2">{row.remaining_qty ?? 0}</td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                max={row.remaining_qty ?? 0}
                                value={row.qty}
                                onChange={(event) => handleGoodsQtyChange(index, event.target.value)}
                                className="w-32 px-2 py-1 border border-gray-300 rounded-lg"
                                required={index === 0}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Delivery Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <p className="text-sm text-gray-500 font-semibold uppercase">Delivery Order Details</p>
                <h2 className="text-xl font-bold text-gray-900">{detailDelivery.delivery_number}</h2>
              </div>
              <button
                onClick={() => setDetailDelivery(null)}
                className="p-2 rounded-full hover:bg-gray-100 transition"
                aria-label="Close delivery order details"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6 space-y-6 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-gray-500">Delivery Date</p>
                  <p className="font-medium text-gray-900">{detailDelivery.delivery_date || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Sales Order</p>
                  <p className="font-medium text-gray-900">
                    {orderMap.get(String(detailDelivery.sales_order_id))?.po_number ||
                      orderMap.get(String(detailDelivery.sales_order_id))?.order_number ||
                      '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Company</p>
                  <p className="font-medium text-gray-900">
                    {detailDelivery.company_name ||
                      orderMap.get(String(detailDelivery.sales_order_id))?.company_name ||
                      '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Created By</p>
                  <p className="font-medium text-gray-900">
                    {detailDelivery.created_by
                      ? usersById[String(detailDelivery.created_by)] || '-'
                      : '-'}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Goods Delivered</h3>
                {parseGoods(detailDelivery.goods).length === 0 ? (
                  <p className="text-gray-500">No goods listed.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="px-3 py-2 text-left">Goods</th>
                          <th className="px-3 py-2 text-left">Description</th>
                          <th className="px-3 py-2 text-left">Unit</th>
                          <th className="px-3 py-2 text-left">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {parseGoods(detailDelivery.goods).map((row, index) => (
                          <tr key={`${row.good_id || row.name}-${index}`}>
                            <td className="px-3 py-2">{row.name || '-'}</td>
                            <td className="px-3 py-2">{row.description || '-'}</td>
                            <td className="px-3 py-2">{row.unit || '-'}</td>
                            <td className="px-3 py-2">{row.qty ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
