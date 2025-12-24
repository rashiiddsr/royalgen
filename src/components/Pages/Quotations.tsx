import { useState, useEffect } from 'react';
import { addRecord, getRecords, updateRecord } from '../../lib/api';
import { Plus, Eye, FileCheck, X, Pencil, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface QuotationGood {
  good_id: string;
  name: string;
  description: string;
  unit: string;
  qty: number;
  price: number;
}

interface QuotationType {
  id: string;
  quotation_number: string;
  rfq_id: string;
  company_name: string;
  project_name: string;
  pic_name: string;
  pic_email: string;
  pic_phone: string;
  delivery_time: string;
  payment_time: string;
  goods: QuotationGood[] | string | null;
  total_amount: number;
  tax_amount: number;
  grand_total: number;
  status: string;
  negotiation_round?: number;
  created_at: string;
  performed_by?: number | null;
  rfqs?: RFQTypeLite;
  creator_name?: string;
}

interface RFQTypeLite {
  id: string;
  rfq_number: string;
  company_name: string;
  project_name: string;
  pic_name: string;
  pic_email: string;
  pic_phone: string;
  status: string;
}

interface GoodOption {
  id: string;
  name: string;
  description: string;
  unit: string;
  status: string;
}

const EMPTY_GOOD_ROW: QuotationGood = {
  good_id: '',
  name: '',
  description: '',
  unit: '',
  qty: 0,
  price: 0,
};

export default function Quotations() {
  const { profile } = useAuth();
  const [quotations, setQuotations] = useState<QuotationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [detailQuotation, setDetailQuotation] = useState<QuotationType | null>(null);
  const [editingQuotation, setEditingQuotation] = useState<QuotationType | null>(null);
  const [statusQuotation, setStatusQuotation] = useState<QuotationType | null>(null);
  const [rfqs, setRfqs] = useState<RFQTypeLite[]>([]);
  const [goods, setGoods] = useState<GoodOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    quotation_number: '',
    rfq_id: '',
    company_name: '',
    project_name: '',
    pic_name: '',
    pic_email: '',
    pic_phone: '',
    delivery_time: '',
    payment_time: '',
    status: 'waiting',
  });
  const [goodsRows, setGoodsRows] = useState<QuotationGood[]>([{ ...EMPTY_GOOD_ROW }]);

  useEffect(() => {
    fetchQuotations();
  }, []);

  const fetchQuotations = async () => {
    try {
      const [quotationData, rfqData, goodsData, userData] = await Promise.all([
        getRecords<QuotationType>('quotations'),
        getRecords<RFQTypeLite>('rfqs'),
        getRecords<GoodOption>('goods'),
        getRecords<{ id: string; full_name?: string; email?: string }>('users'),
      ]);

      const rfqsById = new Map(rfqData.map((rfq) => [rfq.id, rfq]));
      const userMap = userData.reduce<Record<string, string>>((acc, user) => {
        const name = user.full_name || user.email || 'User';
        acc[String(user.id)] = name;
        return acc;
      }, {});
      const mappedQuotations = quotationData
        .map((quotation) => {
          let parsedGoods: QuotationGood[] = [];
          if (Array.isArray(quotation.goods)) {
            parsedGoods = quotation.goods as QuotationGood[];
          } else if (typeof quotation.goods === 'string' && quotation.goods) {
            try {
              parsedGoods = JSON.parse(quotation.goods) as QuotationGood[];
            } catch {
              parsedGoods = [];
            }
          }

          return {
            ...quotation,
            goods: parsedGoods,
            rfqs: rfqsById.get(quotation.rfq_id),
            creator_name:
              quotation.creator_name ||
              (quotation.performed_by ? userMap[String(quotation.performed_by)] : null) ||
              'Unknown user',
          };
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setQuotations(mappedQuotations);
      setRfqs(rfqData);
      setGoods(goodsData);
    } catch (error) {
      console.error('Error fetching quotations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNextQuotationNumber = () => {
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
    const legacyPrefix = `RGI-QTN-${year}-`;
    const maxSequence = quotations.reduce((max, quotation) => {
      const number = quotation.quotation_number || '';
      const legacyMatch = number.startsWith(legacyPrefix)
        ? Number(number.replace(legacyPrefix, ''))
        : null;
      const newMatch = number.match(/^(\d{4})\/RGI\/QTN\/[IVXLCDM]+\/(\d{4})$/);
      const legacySequence = legacyMatch && !Number.isNaN(legacyMatch) ? legacyMatch : null;
      const newSequence =
        newMatch && Number(newMatch[2]) === year ? Number(newMatch[1]) : null;
      const sequence = newSequence ?? legacySequence;
      if (!sequence || Number.isNaN(sequence)) return max;
      return Math.max(max, sequence);
    }, 0);
    const nextSequence = String(maxSequence + 1).padStart(4, '0');
    return `${nextSequence}/RGI/QTN/${romanMonth}/${year}`;
  };

  const canEditQuotation = (quotation: QuotationType) => {
    if (!profile) return false;
    if (quotation.status === 'rejected') return false;
    if (['superadmin', 'manager'].includes(profile.role)) return true;
    if (!quotation.performed_by || !profile.id) return false;
    return String(quotation.performed_by) === String(profile.id);
  };

  const canUpdateStatus = profile && ['superadmin', 'manager'].includes(profile.role);

  const openCreateModal = () => {
    setEditingQuotation(null);
    setFormData({
      quotation_number: getNextQuotationNumber(),
      rfq_id: '',
      company_name: '',
      project_name: '',
      pic_name: '',
      pic_email: '',
      pic_phone: '',
      delivery_time: '',
      payment_time: '',
      status: 'waiting',
    });
    setGoodsRows([{ ...EMPTY_GOOD_ROW }]);
    setShowModal(true);
  };

  const openEditModal = (quotation: QuotationType) => {
    if (!canEditQuotation(quotation)) return;
    const parsedGoods = Array.isArray(quotation.goods) ? quotation.goods : [];
    setEditingQuotation(quotation);
    setFormData({
      quotation_number: quotation.quotation_number,
      rfq_id: quotation.rfq_id,
      company_name: quotation.company_name,
      project_name: quotation.project_name,
      pic_name: quotation.pic_name,
      pic_email: quotation.pic_email,
      pic_phone: quotation.pic_phone,
      delivery_time: quotation.delivery_time,
      payment_time: quotation.payment_time,
      status: quotation.status,
    });
    setGoodsRows(parsedGoods.length ? parsedGoods : [{ ...EMPTY_GOOD_ROW }]);
    setShowModal(true);
  };

  const handleRfqChange = (rfqId: string) => {
    const selectedRfq = rfqs.find((rfq) => String(rfq.id) === String(rfqId));
    setFormData((prev) => ({
      ...prev,
      rfq_id: rfqId,
      company_name: selectedRfq?.company_name || '',
      project_name: selectedRfq?.project_name || '',
      pic_name: selectedRfq?.pic_name || '',
      pic_email: selectedRfq?.pic_email || '',
      pic_phone: selectedRfq?.pic_phone || '',
    }));
  };

  const handleGoodSelect = (index: number, goodId: string) => {
    const selectedGood = goods.find((good) => String(good.id) === String(goodId));
    setGoodsRows((prev) =>
      prev.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        return {
          ...row,
          good_id: goodId,
          name: selectedGood?.name || '',
          description: selectedGood?.description || '',
          unit: selectedGood?.unit || '',
        };
      })
    );
  };

  const handleGoodsRowChange = (index: number, field: keyof QuotationGood, value: string) => {
    setGoodsRows((prev) =>
      prev.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const updatedValue = field === 'qty' || field === 'price' ? Number(value) : value;
        return { ...row, [field]: updatedValue } as QuotationGood;
      })
    );
  };

  const addGoodsRow = () => {
    setGoodsRows((prev) => [...prev, { ...EMPTY_GOOD_ROW }]);
  };

  const removeGoodsRow = (index: number) => {
    setGoodsRows((prev) => (prev.length === 1 ? prev : prev.filter((_, rowIndex) => rowIndex !== index)));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const totalAmount = goodsRows.reduce(
      (sum, row) => sum + (Number(row.qty) || 0) * (Number(row.price) || 0),
      0
    );
    const taxAmount = 0;
    const grandTotal = totalAmount + taxAmount;

    const commonPayload = {
      goods: goodsRows.map((row) => ({
        ...row,
        qty: Number(row.qty) || 0,
        price: Number(row.price) || 0,
      })),
      total_amount: totalAmount,
      tax_amount: taxAmount,
      grand_total: grandTotal,
      delivery_time: formData.delivery_time,
      payment_time: formData.payment_time,
      performed_by: profile?.id,
      performer_role: profile?.role,
    };

    const payload = editingQuotation
      ? commonPayload
      : ({
          ...formData,
          rfq_id: formData.rfq_id,
          status: 'waiting',
          ...commonPayload,
        } as QuotationType);

    try {
      if (editingQuotation) {
        await updateRecord<QuotationType>('quotations', editingQuotation.id, payload);
      } else {
        await addRecord<QuotationType>('quotations', payload);
      }
      setShowModal(false);
      setEditingQuotation(null);
      fetchQuotations();
    } catch (error) {
      console.error('Error saving quotation:', error);
      alert('Failed to save quotation. Please try again.');
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      waiting: 'bg-yellow-100 text-yellow-800',
      negotiation: 'bg-blue-100 text-blue-800',
      renegotiation: 'bg-purple-100 text-purple-800',
      process: 'bg-emerald-100 text-emerald-800',
      active: 'bg-green-100 text-green-800',
      draft: 'bg-gray-100 text-gray-800',
      submitted: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string, round?: number) => {
    if (status === 'renegotiation') return 're-negotiating';
    if (status === 'negotiation' && round) return `negotiation (${round})`;
    return status;
  };

  const renderGoodsSummary = (quotation: QuotationType) => {
    const goodsList = Array.isArray(quotation.goods) ? quotation.goods : [];
    if (!goodsList.length) return 'No goods';
    return goodsList.map((row) => row.name || 'Item').join(', ');
  };

  const filteredQuotations = quotations.filter((quotation) => {
    const query = searchTerm.toLowerCase();
    if (!query) return true;
    return (
      quotation.quotation_number?.toLowerCase().includes(query) ||
      quotation.rfqs?.rfq_number?.toLowerCase().includes(query) ||
      quotation.project_name?.toLowerCase().includes(query) ||
      quotation.company_name?.toLowerCase().includes(query) ||
      quotation.status?.toLowerCase().includes(query) ||
      quotation.creator_name?.toLowerCase().includes(query) ||
      renderGoodsSummary(quotation).toLowerCase().includes(query)
    );
  });

  const handleStatusUpdate = async (quotation: QuotationType, nextStatus: string) => {
    if (!canUpdateStatus || !profile) return;
    if (nextStatus === 'rejected') {
      const confirmed = window.confirm('Are you sure you want to reject this quotation? This will lock edits.');
      if (!confirmed) return;
    }
    try {
      const updated = await updateRecord<QuotationType>('quotations', quotation.id, {
        status: nextStatus,
        performed_by: profile.id,
        performer_role: profile.role,
      });
      await fetchQuotations();
      if (updated) {
        setDetailQuotation((prev) => (prev && prev.id === quotation.id ? { ...prev, ...updated } : prev));
        setStatusQuotation((prev) => (prev && prev.id === quotation.id ? { ...prev, ...updated } : prev));
      }
      setStatusQuotation(null);
    } catch (error) {
      console.error('Failed to update quotation status', error);
      alert('Failed to update status. Please try again.');
    }
  };

  const getStatusActions = (quotation: QuotationType) => {
    if (quotation.status === 'waiting' || quotation.status === 'renegotiation') {
      return [
        { label: 'Set Negotiation', status: 'negotiation', style: 'bg-blue-600 hover:bg-blue-700' },
        { label: 'Reject', status: 'rejected', style: 'bg-red-600 hover:bg-red-700' },
      ];
    }
    if (quotation.status === 'negotiation') {
      return [
        { label: 'Set Process', status: 'process', style: 'bg-emerald-600 hover:bg-emerald-700' },
        { label: 'Reject', status: 'rejected', style: 'bg-red-600 hover:bg-red-700' },
      ];
    }
    return [];
  };

  const activeGoods = goods.filter((good) => good.status === 'active');
  const availableRfqs = rfqs.filter(
    (rfq) => rfq.status === 'draft' || rfq.id === formData.rfq_id
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quotations</h1>
          <p className="text-gray-600 mt-1">Review and manage supplier quotations</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Quotation
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search quotations by number, RFQ, company, goods, or creator..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full md:max-w-lg px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quotation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  RFQ / Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredQuotations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <FileCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No quotations found.</p>
                  </td>
                </tr>
              ) : (
                filteredQuotations.map((quotation) => (
                  <tr key={quotation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {quotation.quotation_number}
                      </div>
                      <div className="text-xs text-gray-500">{quotation.company_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {quotation.rfqs?.rfq_number || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">{quotation.project_name || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        Rp {quotation.grand_total.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        Tax: Rp {quotation.tax_amount.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {quotation.creator_name || 'Unknown user'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(quotation.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          quotation.status
                        )}`}
                      >
                        {getStatusLabel(quotation.status, quotation.negotiation_round)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setDetailQuotation(quotation)}
                        className="inline-flex items-center p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {canUpdateStatus &&
                        ['waiting', 'renegotiation', 'negotiation'].includes(quotation.status) && (
                          <button
                            onClick={() => setStatusQuotation(quotation)}
                            className="inline-flex items-center p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                            title="Update status"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                      <button
                        onClick={() => openEditModal(quotation)}
                        className={`inline-flex items-center p-2 rounded-lg transition ${
                          canEditQuotation(quotation)
                            ? 'text-gray-600 hover:bg-gray-100'
                            : 'text-gray-300 cursor-not-allowed'
                        }`}
                        disabled={!canEditQuotation(quotation)}
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
                <p className="text-sm text-gray-500 font-semibold uppercase">Quotation</p>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingQuotation ? 'Edit Quotation' : 'Create Quotation'}
                </h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition"
                aria-label="Close quotation modal"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quotation Number</label>
                  <input
                    type="text"
                    value={formData.quotation_number}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RFQ Number</label>
                  <select
                    value={formData.rfq_id}
                    onChange={(event) => handleRfqChange(event.target.value)}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                      editingQuotation ? 'bg-gray-50 cursor-not-allowed' : ''
                    }`}
                    required={!editingQuotation}
                    disabled={!!editingQuotation}
                  >
                    <option value="">Select RFQ</option>
                    {availableRfqs.map((rfq) => (
                      <option key={rfq.id} value={rfq.id}>
                        {rfq.rfq_number} - {rfq.project_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                  <input
                    type="text"
                    value={formData.project_name}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PIC Email</label>
                  <input
                    type="email"
                    value={formData.pic_email}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PIC Phone</label>
                  <input
                    type="text"
                    value={formData.pic_phone}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Time (days)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.delivery_time}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, delivery_time: event.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Time (days)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.payment_time}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, payment_time: event.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Goods</h3>
                  <button
                    type="button"
                    onClick={addGoodsRow}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Add Row
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Goods</th>
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-left">Unit</th>
                        <th className="px-3 py-2 text-left">Qty</th>
                        <th className="px-3 py-2 text-left">Price</th>
                        <th className="px-3 py-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {goodsRows.map((row, index) => (
                        <tr key={`${row.good_id}-${index}`}>
                          <td className="px-3 py-2">
                            <select
                              value={row.good_id}
                              onChange={(event) => handleGoodSelect(index, event.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded-lg"
                              required
                            >
                              <option value="">Select goods</option>
                              {activeGoods.map((good) => (
                                <option key={good.id} value={good.id}>
                                  {good.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={row.description}
                              readOnly
                              className="w-full px-2 py-1 border border-gray-300 rounded-lg bg-gray-50"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={row.unit}
                              readOnly
                              className="w-full px-2 py-1 border border-gray-300 rounded-lg bg-gray-50"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              value={row.qty}
                              onChange={(event) =>
                                handleGoodsRowChange(index, 'qty', event.target.value)
                              }
                              className="w-full px-2 py-1 border border-gray-300 rounded-lg"
                              required
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              value={row.price}
                              onChange={(event) =>
                                handleGoodsRowChange(index, 'price', event.target.value)
                              }
                              className="w-full px-2 py-1 border border-gray-300 rounded-lg"
                              required
                            />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => removeGoodsRow(index)}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
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
                  {editingQuotation ? 'Update Quotation' : 'Save Quotation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {statusQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <p className="text-sm text-gray-500 font-semibold uppercase">Quotation Status</p>
                <h2 className="text-xl font-bold text-gray-900">Update Status</h2>
              </div>
              <button
                onClick={() => setStatusQuotation(null)}
                className="p-2 rounded-full hover:bg-gray-100 transition"
                aria-label="Close status modal"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm text-gray-600">
                <p className="font-semibold text-gray-900">{statusQuotation.quotation_number}</p>
                <p className="mt-1">
                  Current status:{' '}
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                      statusQuotation.status
                    )}`}
                  >
                    {getStatusLabel(statusQuotation.status, statusQuotation.negotiation_round)}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {getStatusActions(statusQuotation).map((action) => (
                  <button
                    key={action.status}
                    type="button"
                    onClick={() => handleStatusUpdate(statusQuotation, action.status)}
                    className={`px-3 py-2 text-sm text-white rounded-lg ${action.style}`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {detailQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <p className="text-sm text-gray-500 font-semibold uppercase">Quotation Details</p>
                <h2 className="text-xl font-bold text-gray-900">{detailQuotation.quotation_number}</h2>
              </div>
              <button
                onClick={() => setDetailQuotation(null)}
                className="p-2 rounded-full hover:bg-gray-100 transition"
                aria-label="Close quotation details"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">RFQ</p>
                  <p className="font-medium text-gray-900">{detailQuotation.rfqs?.rfq_number || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Company</p>
                  <p className="font-medium text-gray-900">{detailQuotation.company_name || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Project</p>
                  <p className="font-medium text-gray-900">{detailQuotation.project_name || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">PIC</p>
                  <p className="font-medium text-gray-900">{detailQuotation.pic_name || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">{detailQuotation.pic_email || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Phone</p>
                  <p className="font-medium text-gray-900">{detailQuotation.pic_phone || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Delivery Time</p>
                  <p className="font-medium text-gray-900">
                    {detailQuotation.delivery_time ? `${detailQuotation.delivery_time} days` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Payment Time</p>
                  <p className="font-medium text-gray-900">
                    {detailQuotation.payment_time ? `${detailQuotation.payment_time} days` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Status</p>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                      detailQuotation.status
                    )}`}
                  >
                    {getStatusLabel(detailQuotation.status, detailQuotation.negotiation_round)}
                  </span>
                </div>
                <div>
                  <p className="text-gray-500">Created By</p>
                  <p className="font-medium text-gray-900">{detailQuotation.creator_name || '-'}</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Goods</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Goods</th>
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-left">Unit</th>
                        <th className="px-3 py-2 text-left">Qty</th>
                        <th className="px-3 py-2 text-left">Price</th>
                        <th className="px-3 py-2 text-left">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(Array.isArray(detailQuotation.goods) ? detailQuotation.goods : []).map((row, index) => (
                        <tr key={`${row.good_id}-${index}`}>
                          <td className="px-3 py-2">{row.name || '-'}</td>
                          <td className="px-3 py-2">{row.description || '-'}</td>
                          <td className="px-3 py-2">{row.unit || '-'}</td>
                          <td className="px-3 py-2">{row.qty}</td>
                          <td className="px-3 py-2">Rp {Number(row.price).toLocaleString()}</td>
                          <td className="px-3 py-2">
                            Rp {(Number(row.qty) * Number(row.price)).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end text-sm">
                <div className="text-right space-y-1">
                  <div>
                    <span className="text-gray-500">Total:</span>{' '}
                    <span className="font-semibold">Rp {detailQuotation.total_amount.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Tax:</span>{' '}
                    <span className="font-semibold">Rp {detailQuotation.tax_amount.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Grand Total:</span>{' '}
                    <span className="font-semibold">Rp {detailQuotation.grand_total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
