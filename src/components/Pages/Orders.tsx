import { useEffect, useMemo, useState } from 'react';
import { addRecord, getRecords, updateRecord } from '../../lib/api';
import { Eye, Pencil, Plus, Search, ShoppingCart, UploadCloud, X } from 'lucide-react';

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
  deadline_days?: number;
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
  const [orders, setOrders] = useState<OrderType[]>([]);
  const [quotations, setQuotations] = useState<QuotationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [detailOrder, setDetailOrder] = useState<OrderType | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrderType | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [goodsRows, setGoodsRows] = useState<OrderGood[]>([]);
  const [documents, setDocuments] = useState<OrderDocument[]>([]);
  const [documentsError, setDocumentsError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const isEditing = Boolean(editingOrder);
  const apiRoot = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/api$/, '');

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
      const [orderData, quotationData] = await Promise.all([
        getRecords<OrderType>('sales_orders'),
        getRecords<QuotationType>('quotations'),
      ]);

      const quotationMap = new Map(quotationData.map((quotation) => [quotation.id, quotation]));
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
        deadline_days: row.deadline_days ?? 0,
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
      deadline_days: 0,
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
        return { ...row, deadline_days: Number(value) };
      })
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (documents.length === 0) {
      setDocumentsError('Documents are required.');
      return;
    }
    const invalidDeadline = goodsRows.find(
      (row) => row.deadline_days === null || row.deadline_days === undefined || Number(row.deadline_days) < 0
    );
    if (invalidDeadline) {
      alert('Deadline (days) is required for each goods.');
      return;
    }
    const totalAmount = goodsRows.reduce(
      (sum, row) => sum + (Number(row.qty) || 0) * (Number(row.price) || 0),
      0
    );
    const taxAmount = 0;
    const grandTotal = totalAmount + taxAmount;

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
      total_amount: totalAmount,
      tax_amount: taxAmount,
      grand_total: grandTotal,
      documents,
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
        } as OrderType);

    try {
      if (editingOrder) {
        await updateRecord<OrderType>('sales_orders', editingOrder.id, payload);
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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      ongoing: 'bg-blue-100 text-blue-800',
      delivery: 'bg-purple-100 text-purple-800',
      payment: 'bg-amber-100 text-amber-800',
      done: 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No sales orders found.</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
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
                        onClick={() => setDetailOrder(order)}
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
                            <td className="px-3 py-2">Rp {Number(row.price || 0).toLocaleString()}</td>
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
                              Rp {(Number(row.qty || 0) * Number(row.price || 0)).toLocaleString()}
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
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
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
              <button
                onClick={() => setDetailOrder(null)}
                className="p-2 rounded-full hover:bg-gray-100 transition"
                aria-label="Close sales order details"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
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
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Goods</h3>
                {parseGoods(detailOrder.goods).length === 0 ? (
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
                        {parseGoods(detailOrder.goods).map((row, index) => (
                          <tr key={`${row.good_id || row.name}-${index}`}>
                            <td className="px-3 py-2">{index + 1}</td>
                            <td className="px-3 py-2">{row.name || '-'}</td>
                            <td className="px-3 py-2">{row.description || '-'}</td>
                            <td className="px-3 py-2">{row.unit || '-'}</td>
                            <td className="px-3 py-2">{row.qty}</td>
                            <td className="px-3 py-2">Rp {Number(row.price || 0).toLocaleString()}</td>
                            <td className="px-3 py-2">{row.deadline_days ?? '-'}</td>
                            <td className="px-3 py-2">
                              Rp {(Number(row.qty || 0) * Number(row.price || 0)).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

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
