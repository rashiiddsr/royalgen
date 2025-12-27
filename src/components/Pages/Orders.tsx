import { useEffect, useMemo, useState } from 'react';
import { addRecord, getRecords, updateRecord } from '../../lib/api';
import { formatRupiah } from '../../lib/format';
import { Eye, Pencil, Plus, Search, ShoppingCart, UploadCloud, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface OrderDocument {
  name: string;
  data?: string;
  url?: string;
}

interface OrderGood {
  good_id?: string;
  name?: string;
  description?: string;
  unit?: string;
  qty: number;
  price: number;
  deadline_days?: number | '';
}

interface OrderType {
  id: string;
  order_number: string;
  po_number?: string;
  project_name?: string;
  order_date?: string;
  quotation_id: string;
  company_name?: string;
  pic_name?: string;
  pic_email?: string;
  pic_phone?: string;
  payment_time?: string;
  goods?: OrderGood[] | string | null;
  documents?: OrderDocument[] | string | null;
  total_amount?: number;
  tax_amount?: number;
  grand_total?: number;
  status: string;
  created_by?: number | null;
  last_edited_by?: number | null;
  created_at: string;
  quotations?: QuotationType;
}

interface QuotationType {
  id: string;
  quotation_number: string;
  company_name: string;
  pic_name: string;
  pic_email: string;
  pic_phone: string;
  payment_time: string;
  status: string;
  goods?: OrderGood[] | string | null;
  total_amount?: number;
  tax_amount?: number;
  grand_total?: number;
  include_tax?: number | boolean;
}

interface DeliveryOrder {
  id: string;
  delivery_number: string;
  delivery_date?: string;
  sales_order_id: string;
  created_at: string;
}

const EMPTY_FORM = {
  project_name: '',
  po_number: '',
  order_date: '',
  quotation_id: '',
  company_name: '',
  pic_name: '',
  pic_email: '',
  pic_phone: '',
  payment_time: '',
};

export default function Orders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<OrderType[]>([]);
  const [quotations, setQuotations] = useState<QuotationType[]>([]);
  const [usersById, setUsersById] = useState<Record<string, string>>({});
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [detailOrder, setDetailOrder] = useState<OrderType | null>(null);
  const [showDoModal, setShowDoModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderType | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [goodsRows, setGoodsRows] = useState<OrderGood[]>([]);
  const [documents, setDocuments] = useState<OrderDocument[]>([]);
  const [documentsError, setDocumentsError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const isEditing = Boolean(editingOrder);
  const apiRoot = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/api$/, '');
  const canApprovePayment = profile?.role === 'superadmin' || profile?.role === 'manager';

  useEffect(() => {
    fetchOrders();
  }, []);

  const parseGoods = (goods?: OrderGood[] | string | null) => {
    if (!goods) return [];
    if (Array.isArray(goods)) return goods;
    if (typeof goods === 'string') {
      try {
        return JSON.parse(goods) as OrderGood[];
      } catch {
        return [];
      }
    }
    return [];
  };

  const parseDocuments = (docs?: OrderDocument[] | string | null) => {
    if (!docs) return [];
    if (Array.isArray(docs)) return docs;
    if (typeof docs === 'string') {
      try {
        return JSON.parse(docs) as OrderDocument[];
      } catch {
        return [];
      }
    }
    return [];
  };

  const normalizePoNumber = (value?: string | null) => {
    if (!value) return '';
    return value.split('\n')[0].trim();
  };

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateInput = (value?: string | null) => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return formatLocalDate(date);
  };

  const formatDateDisplay = (value?: string | null) => {
    if (!value) return '-';
    return formatDateInput(value);
  };

  const formatCurrency = (value: number) => `Rp ${formatRupiah(value)}`;

  const resolveOrderTotals = (orderGoods: OrderGood[], order?: OrderType) => {
    const subtotal =
      order?.total_amount !== undefined && order?.total_amount !== null
        ? Number(order.total_amount) || 0
        : orderGoods.reduce(
            (sum, row) => sum + (Number(row.qty) || 0) * (Number(row.price) || 0),
            0
          );
    const tax =
      order?.tax_amount !== undefined && order?.tax_amount !== null ? Number(order.tax_amount) || 0 : 0;
    const grand =
      order?.grand_total !== undefined && order?.grand_total !== null
        ? Number(order.grand_total) || subtotal + tax
        : subtotal + tax;
    return { subtotal, tax, grand };
  };

  const resolveDocumentUrl = (doc: OrderDocument) => {
    if (doc.url) {
      if (doc.url.startsWith('http') || doc.url.startsWith('data:')) {
        return doc.url;
      }
      return `${apiRoot}${doc.url}`;
    }
    return doc.data;
  };

  const fetchOrders = async () => {
    try {
      const [orderData, quotationData, userData, deliveryData] = await Promise.all([
        getRecords<OrderType>('sales_orders'),
        getRecords<QuotationType>('quotations'),
        getRecords<{ id: string; full_name?: string; email?: string }>('users'),
        getRecords<DeliveryOrder>('delivery_orders'),
      ]);

      const quotationMap = new Map(quotationData.map((quotation) => [quotation.id, quotation]));
      const userMap = userData.reduce<Record<string, string>>((acc, user) => {
        const name = user.full_name || user.email || 'User';
        acc[String(user.id)] = name;
        return acc;
      }, {});
      const mappedOrders = orderData
        .map((order) => ({
          ...order,
          goods: parseGoods(order.goods),
          documents: parseDocuments(order.documents),
          po_number: normalizePoNumber(order.po_number || order.order_number),
          quotations: quotationMap.get(order.quotation_id),
        }))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setOrders(mappedOrders);
      setDeliveries(deliveryData);
      setUsersById(userMap);
      setQuotations(
        quotationData.map((quotation) => ({
          ...quotation,
          goods: parseGoods(quotation.goods),
        }))
      );
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingOrder(null);
    setFormData(EMPTY_FORM);
    setGoodsRows([]);
    setDocuments([]);
    setDocumentsError('');
    setShowModal(true);
  };

  const openEditModal = (order: OrderType) => {
    setEditingOrder(order);
    setFormData({
      project_name: order.project_name || '',
      po_number: normalizePoNumber(order.po_number || order.order_number || ''),
      order_date: formatDateInput(order.order_date),
      quotation_id: order.quotation_id || '',
      company_name: order.company_name || '',
      pic_name: order.pic_name || '',
      pic_email: order.pic_email || '',
      pic_phone: order.pic_phone || '',
      payment_time: order.payment_time || '',
    });
    setGoodsRows(
      parseGoods(order.goods).map((row) => ({
        ...row,
        deadline_days: row.deadline_days ?? '',
      }))
    );
    setDocuments(parseDocuments(order.documents));
    setDocumentsError('');
    setShowModal(true);
  };

  const handleQuotationChange = (quotationId: string) => {
    const quotation = quotations.find((item) => String(item.id) === String(quotationId));
    setFormData((prev) => ({
      ...prev,
      quotation_id: quotationId,
      company_name: quotation?.company_name || '',
      pic_name: quotation?.pic_name || '',
      pic_email: quotation?.pic_email || '',
      pic_phone: quotation?.pic_phone || '',
      payment_time: quotation?.payment_time || '',
    }));
      const nextGoods = parseGoods(quotation?.goods || []).map((row) => ({
        good_id: row.good_id,
        name: row.name,
        description: row.description,
        unit: row.unit,
        qty: row.qty,
        price: row.price,
        deadline_days: '',
      }));
    setGoodsRows(nextGoods);
  };

  const handleDocumentsChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (!files.length) return;
    const oversizedFile = files.find((file) => file.size > 5 * 1024 * 1024);
    if (oversizedFile) {
      event.target.value = '';
      setDocumentsError('File too large. Maximum size is 5MB per file.');
      return;
    }

    const filePromises = files.map(
      (file) =>
        new Promise<OrderDocument>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result?.toString();
            if (!result) return reject(new Error('Failed to read file'));
            resolve({ name: file.name, data: result });
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        })
    );

    try {
      const uploadedFiles = await Promise.all(filePromises);
      setDocuments((prev) => {
        const filtered = prev.filter(
          (doc) => !uploadedFiles.some((uploaded) => uploaded.name === doc.name)
        );
        return [...filtered, ...uploadedFiles];
      });
      setDocumentsError('');
    } catch (error) {
      console.error('Failed to upload documents', error);
    } finally {
      event.target.value = '';
    }
  };

  const removeDocument = (index: number) => {
    setDocuments((prev) => prev.filter((_, docIndex) => docIndex !== index));
  };

  const handleGoodsDeadlineChange = (index: number, value: string) => {
    setGoodsRows((prev) =>
      prev.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const deadlineValue = value === '' ? '' : Number(value);
        return { ...row, deadline_days: deadlineValue };
      })
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (documents.length === 0) {
      setDocumentsError('Documents are required.');
      return;
    }
    const invalidDeadline = goodsRows.find((row) => {
      if (row.deadline_days === '' || row.deadline_days === null || row.deadline_days === undefined) {
        return true;
      }
      return Number(row.deadline_days) < 0;
    });
    if (invalidDeadline) {
      alert('Deadline (days) is required for each goods.');
      return;
    }
    const totalAmount = goodsRows.reduce(
      (sum, row) => sum + (Number(row.qty) || 0) * (Number(row.price) || 0),
      0
    );
    const selectedQuotation = quotations.find((item) => String(item.id) === String(formData.quotation_id));
    const taxAmount =
      selectedQuotation && selectedQuotation.tax_amount !== undefined
        ? Number(selectedQuotation.tax_amount) || 0
        : 0;
    const grandTotal =
      selectedQuotation && selectedQuotation.grand_total !== undefined
        ? Number(selectedQuotation.grand_total) || totalAmount + taxAmount
        : totalAmount + taxAmount;
    const resolvedTotalAmount =
      selectedQuotation && selectedQuotation.total_amount !== undefined
        ? Number(selectedQuotation.total_amount) || totalAmount
        : totalAmount;

    const basePayload = {
      order_number: formData.po_number,
      po_number: formData.po_number,
      project_name: formData.project_name,
      order_date: formData.order_date,
      payment_time: formData.payment_time,
      goods: goodsRows.map((row) => ({
        ...row,
        deadline_days: Number(row.deadline_days) || 0,
      })),
      total_amount: resolvedTotalAmount,
      tax_amount: taxAmount,
      grand_total: grandTotal,
      documents,
      performed_by: profile?.id,
    };
    const payload = editingOrder
      ? basePayload
      : ({
          ...basePayload,
          quotation_id: formData.quotation_id,
          company_name: formData.company_name,
          pic_name: formData.pic_name,
          pic_email: formData.pic_email,
          pic_phone: formData.pic_phone,
          status: 'ongoing',
          created_by: profile?.id,
        } as OrderType);

    try {
      if (editingOrder) {
        await updateRecord<OrderType>('sales_orders', editingOrder.id, {
          ...payload,
          performed_by: profile?.id,
        });
      } else {
        await addRecord<OrderType>('sales_orders', payload);
      }
      setShowModal(false);
      setEditingOrder(null);
      await fetchOrders();
    } catch (error) {
      console.error('Failed to save sales order', error);
      alert('Failed to save sales order. Please try again.');
    }
  };

  const handleApprovePayment = async () => {
    if (!detailOrder) return;
    const confirmed = window.confirm('Approve this sales order to move to waiting payment?');
    if (!confirmed) return;
    try {
      await updateRecord<OrderType>('sales_orders', detailOrder.id, {
        status: 'waiting payment',
        performed_by: profile?.id,
        performer_role: profile?.role,
      });
      await fetchOrders();
      setDetailOrder((prev) => (prev ? { ...prev, status: 'waiting payment' } : prev));
    } catch (error) {
      console.error('Failed to update sales order status', error);
      alert('Failed to update status. Please try again.');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      ongoing: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200',
      'on-delivery': 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200',
      'waiting approval': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200',
      'waiting payment': 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
      done: 'bg-green-100 text-green-800 dark:bg-emerald-500/20 dark:text-emerald-200',
      delivery: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200',
      payment: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-100';
  };

  const filteredOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return orders;
    return orders.filter((order) => {
      const quotationNumber = order.quotations?.quotation_number || '';
      return (
        order.order_number?.toLowerCase().includes(query) ||
        order.po_number?.toLowerCase().includes(query) ||
        order.project_name?.toLowerCase().includes(query) ||
        order.company_name?.toLowerCase().includes(query) ||
        quotationNumber.toLowerCase().includes(query) ||
        order.status?.toLowerCase().includes(query)
      );
    });
  }, [orders, searchTerm]);

  const linkedDeliveries = detailOrder
    ? deliveries
        .filter((delivery) => String(delivery.sales_order_id) === String(detailOrder.id))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : [];
  const detailGoods = detailOrder ? parseGoods(detailOrder.goods) : [];
  const detailTotals = detailOrder ? resolveOrderTotals(detailGoods, detailOrder) : null;

  const usedQuotationIds = useMemo(
    () => new Set(orders.map((order) => String(order.quotation_id))),
    [orders]
  );
  const availableQuotations = quotations.filter(
    (quotation) =>
      quotation.status === 'process' &&
      (!usedQuotationIds.has(String(quotation.id)) ||
        String(quotation.id) === String(formData.quotation_id))
  );

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
          <h1 className="text-3xl font-bold text-gray-900">Sales Orders</h1>
          <p className="text-gray-600 mt-1">Manage and track sales orders</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Order
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search sales orders by PO, project, quotation, company, or status..."
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
                  PO Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quotation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No sales orders found.</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {order.po_number || order.order_number}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{order.project_name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {order.quotations?.quotation_number || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{order.company_name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {order.created_by ? usersById[String(order.created_by)] || '-' : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatDateDisplay(order.order_date)}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setDetailOrder(order);
                          setShowDoModal(false);
                        }}
                        className="inline-flex items-center p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        aria-label="View order"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(order)}
                        className="inline-flex items-center p-2 rounded-lg transition text-gray-600 hover:bg-gray-100"
                        aria-label="Edit order"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
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
                <p className="text-sm text-gray-500 font-semibold uppercase">Sales Order</p>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingOrder ? 'Edit Sales Order' : 'Create Sales Order'}
                </h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition"
                aria-label="Close sales order modal"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.project_name}
                    onChange={(event) => setFormData((prev) => ({ ...prev, project_name: event.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PO Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.po_number}
                    onChange={(event) => setFormData((prev) => ({ ...prev, po_number: event.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.order_date}
                    onChange={(event) => setFormData((prev) => ({ ...prev, order_date: event.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quotation Number <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.quotation_id}
                    onChange={(event) => handleQuotationChange(event.target.value)}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                      editingOrder ? 'bg-gray-50 cursor-not-allowed' : ''
                    }`}
                    required
                    disabled={isEditing}
                  >
                    <option value="">Select quotation</option>
                    {availableQuotations.map((quotation) => (
                      <option key={quotation.id} value={quotation.id}>
                        {quotation.quotation_number}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <input
                    type="text"
                    value={formData.company_name}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PIC Name</label>
                  <input
                    type="text"
                    value={formData.pic_name}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PIC Email</label>
                  <input
                    type="email"
                    value={formData.pic_email}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PIC Number</label>
                  <input
                    type="text"
                    value={formData.pic_phone}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Time</label>
                  <input
                    type="text"
                    value={formData.payment_time}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Goods</h3>
                {goodsRows.length === 0 ? (
                  <div className="text-sm text-gray-500">Select a quotation to load goods.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="px-3 py-2 text-left">No</th>
                          <th className="px-3 py-2 text-left">Goods</th>
                          <th className="px-3 py-2 text-left">Description</th>
                          <th className="px-3 py-2 text-left">Unit</th>
                          <th className="px-3 py-2 text-left">Qty</th>
                          <th className="px-3 py-2 text-left">Price</th>
                          <th className="px-3 py-2 text-left">
                            Deadline (days) <span className="text-red-500">*</span>
                          </th>
                          <th className="px-3 py-2 text-left">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {goodsRows.map((row, index) => (
                          <tr key={`${row.good_id || row.name}-${index}`}>
                            <td className="px-3 py-2">{index + 1}</td>
                            <td className="px-3 py-2">{row.name || '-'}</td>
                            <td className="px-3 py-2">{row.description || '-'}</td>
                            <td className="px-3 py-2">{row.unit || '-'}</td>
                            <td className="px-3 py-2">{row.qty}</td>
                            <td className="px-3 py-2">{formatCurrency(Number(row.price || 0))}</td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                value={row.deadline_days ?? ''}
                                onChange={(event) => handleGoodsDeadlineChange(index, event.target.value)}
                                className="w-24 px-2 py-1 border border-gray-300 rounded-lg"
                                required
                              />
                            </td>
                            <td className="px-3 py-2">
                              {formatCurrency((Number(row.qty || 0) * Number(row.price || 0)))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Documents <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-3 p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <UploadCloud className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-800">Upload supporting documents</p>
                    <p className="text-xs text-gray-500">PDF or image, max 5MB each</p>
                    <input
                      type="file"
                      multiple
                      onChange={handleDocumentsChange}
                      className="mt-2"
                      required={documents.length === 0}
                    />
                  </div>
                </div>
                {documentsError && <p className="text-xs text-red-600 mt-2">{documentsError}</p>}
                {documents.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-gray-600">
                    {documents.map((doc, index) => (
                      <li key={`${doc.name}-${index}`} className="flex items-center justify-between gap-2">
                        <span>{doc.name}</span>
                        <button
                          type="button"
                          onClick={() => removeDocument(index)}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingOrder ? 'Update Sales Order' : 'Save Sales Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <p className="text-sm text-gray-500 font-semibold uppercase">Sales Order Details</p>
                <h2 className="text-xl font-bold text-gray-900">
                  {detailOrder.po_number || detailOrder.order_number}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {canApprovePayment && detailOrder.status === 'waiting approval' && (
                  <button
                    type="button"
                    onClick={handleApprovePayment}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    Approve Payment
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowDoModal((prev) => !prev)}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  View DO Linked
                </button>
                <button
                  onClick={() => {
                    setDetailOrder(null);
                    setShowDoModal(false);
                  }}
                  className="p-2 rounded-full hover:bg-gray-100 transition"
                  aria-label="Close sales order details"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-gray-500">Project</p>
                  <p className="font-medium text-gray-900">{detailOrder.project_name || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Quotation</p>
                  <p className="font-medium text-gray-900">
                    {detailOrder.quotations?.quotation_number || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Date</p>
                  <p className="font-medium text-gray-900">
                    {formatDateDisplay(detailOrder.order_date)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Company</p>
                  <p className="font-medium text-gray-900">{detailOrder.company_name || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">PIC</p>
                  <p className="font-medium text-gray-900">{detailOrder.pic_name || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">{detailOrder.pic_email || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Phone</p>
                  <p className="font-medium text-gray-900">{detailOrder.pic_phone || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Payment Time</p>
                  <p className="font-medium text-gray-900">{detailOrder.payment_time || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Status</p>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                      detailOrder.status
                    )}`}
                  >
                    {detailOrder.status}
                  </span>
                </div>
                <div>
                  <p className="text-gray-500">Last Edited</p>
                  <p className="font-medium text-gray-900">
                    {detailOrder.last_edited_by
                      ? usersById[String(detailOrder.last_edited_by)] || '-'
                      : '-'}
                  </p>
                </div>
              </div>

              {showDoModal && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Linked Delivery Orders</h3>
                </div>
                  {linkedDeliveries.length === 0 ? (
                    <p className="text-sm text-gray-500">No delivery orders linked yet.</p>
                  ) : (
                    <ul className="space-y-2 text-sm text-gray-700">
                      {linkedDeliveries.map((delivery) => (
                        <li
                          key={delivery.id}
                          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
                        >
                          <div>
                            <p className="font-medium text-gray-900">{delivery.delivery_number}</p>
                            <p className="text-xs text-gray-500">
                              {delivery.delivery_date || '-'}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Goods</h3>
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        `${window.location.origin}/?progress_order=${detailOrder.id}`,
                        '_blank',
                        'noopener,noreferrer'
                      )
                    }
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    View Progress
                  </button>
                </div>
                {detailGoods.length === 0 ? (
                  <p className="text-gray-500">No goods listed.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="px-3 py-2 text-left">No</th>
                          <th className="px-3 py-2 text-left">Goods</th>
                          <th className="px-3 py-2 text-left">Description</th>
                          <th className="px-3 py-2 text-left">Unit</th>
                          <th className="px-3 py-2 text-left">Qty</th>
                          <th className="px-3 py-2 text-left">Price</th>
                          <th className="px-3 py-2 text-left">Deadline (days)</th>
                          <th className="px-3 py-2 text-left">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {detailGoods.map((row, index) => (
                          <tr key={`${row.good_id || row.name}-${index}`}>
                            <td className="px-3 py-2">{index + 1}</td>
                            <td className="px-3 py-2">{row.name || '-'}</td>
                            <td className="px-3 py-2">{row.description || '-'}</td>
                            <td className="px-3 py-2">{row.unit || '-'}</td>
                            <td className="px-3 py-2">{row.qty}</td>
                            <td className="px-3 py-2">{formatCurrency(Number(row.price || 0))}</td>
                            <td className="px-3 py-2">{row.deadline_days ?? '-'}</td>
                            <td className="px-3 py-2">
                              {formatCurrency((Number(row.qty || 0) * Number(row.price || 0)))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {detailTotals && (
                <div className="flex justify-end text-sm">
                  <div className="text-right space-y-1">
                    <div>
                      <span className="text-gray-500">Subtotal:</span>{' '}
                      <span className="font-semibold">{formatCurrency(detailTotals.subtotal)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Tax:</span>{' '}
                      <span className="font-semibold">{formatCurrency(detailTotals.tax)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Grand Total:</span>{' '}
                      <span className="font-semibold">{formatCurrency(detailTotals.grand)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Documents</h3>
                {parseDocuments(detailOrder.documents).length === 0 ? (
                  <p className="text-gray-500">No documents uploaded.</p>
                ) : (
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    {parseDocuments(detailOrder.documents).map((doc, index) => (
                      <li key={`${doc.name}-${index}`}>
                        {resolveDocumentUrl(doc) ? (
                          <a
                            href={resolveDocumentUrl(doc)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:text-blue-700 underline"
                            download={doc.name}
                          >
                            {doc.name}
                          </a>
                        ) : (
                          doc.name
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
