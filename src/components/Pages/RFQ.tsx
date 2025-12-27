import { useState, useEffect, ChangeEvent, FormEvent, useMemo } from 'react';
import { addRecord, getRecords, updateRecord } from '../../lib/api';
import { Plus, FileText, UploadCloud, Trash2, Search, Eye, Edit2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface RFQGoodItem {
  type: 'existing' | 'other';
  good_id?: string | number | null;
  name?: string | null;
  display_name?: string;
}

interface RFQType {
  id: string;
  rfq_number: string;
  company_name: string;
  pic_name: string;
  pic_email: string;
  pic_phone: string;
  goods: RFQGoodItem[];
  attachment_url?: string | null;
  status: string;
  performed_by?: number | null;
  created_at: string;
  requester_name?: string;
}

interface GoodOption {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  full_name?: string;
  email?: string;
}

const DEFAULT_FORM = {
  rfq_number: '',
  company_name: '',
  pic_name: '',
  pic_email: '',
  pic_phone: '',
};

export default function RFQ() {
  const { profile } = useAuth();
  const apiRoot = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/api$/, ''),
    [],
  );
  const [rfqs, setRfqs] = useState<RFQType[]>([]);
  const [goods, setGoods] = useState<GoodOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingRfq, setEditingRfq] = useState<RFQType | null>(null);
  const [detailRfq, setDetailRfq] = useState<RFQType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [goodsSearch, setGoodsSearch] = useState('');
  const [selectedGoods, setSelectedGoods] = useState<string[]>([]);
  const [otherGoods, setOtherGoods] = useState<string[]>(['']);
  const [attachmentData, setAttachmentData] = useState<string | null>(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [goodsError, setGoodsError] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const [contactError, setContactError] = useState('');
  const editableRoles = ['superadmin', 'admin', 'manager'];
  const normalizePhoneInput = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === '-') return '-';
    const digits = trimmed.replace(/\D/g, '');
    if (!digits || digits === '62') return '';
    if (digits.startsWith('62')) return `+${digits}`;
    if (digits.startsWith('0')) return `+62${digits.slice(1)}`;
    return `+62${digits}`;
  };
  const isValidEmail = (value: string) => value === '-' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const isValidPhone = (value: string) => value === '-' || /^\+62\d{6,}$/.test(value);
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
      process: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200',
      approved: 'bg-green-100 text-green-800 dark:bg-emerald-500/20 dark:text-emerald-200',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200',
      canceled: 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-100',
      cancelled: 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-100',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-100';
  };
  const canEditRfq = (rfq: RFQType) => {
    if (!profile) return false;
    if (rfq.status === 'process') return false;
    if (editableRoles.includes(profile.role)) return true;
    if (!rfq.performed_by || !profile.id) return false;
    return String(rfq.performed_by) === String(profile.id);
  };

  useEffect(() => {
    fetchData();
    const interval = window.setInterval(() => {
      fetchData();
    }, 60000);
    return () => window.clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rfqData, goodsData, userData] = await Promise.all([
        getRecords<RFQType>('rfqs'),
        getRecords<GoodOption>('goods'),
        getRecords<UserOption>('users'),
      ]);

      const userMap = userData.reduce<Record<string, string>>((acc, user) => {
        const name = user.full_name || user.email || 'User';
        acc[String(user.id)] = name;
        return acc;
      }, {});

      setRfqs(
        rfqData
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .map((item) => ({
            ...item,
            requester_name:
              item.requester_name ||
              (item.performed_by ? userMap[String(item.performed_by)] : null) ||
              'Unknown user',
          })),
      );
      setGoods(goodsData.map((good) => ({ id: good.id, name: (good as any).name || '' })));
    } catch (error) {
      console.error('Error fetching RFQs or goods:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      event.target.value = '';
      setAttachmentData(null);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result?.toString();
      if (result) {
        setAttachmentData(result);
        if (attachmentError) setAttachmentError('');
      }
    };
    reader.readAsDataURL(file);
  };

  const updateOtherGood = (index: number, value: string) => {
    setOtherGoods((prev) => prev.map((item, idx) => (idx === index ? value : item)));
    if (goodsError) setGoodsError('');
  };

  const addOtherGood = () => setOtherGoods((prev) => [...prev, '']);
  const removeOtherGood = (index: number) => setOtherGoods((prev) => prev.filter((_, idx) => idx !== index));

  const resetForm = () => {
    setFormData(DEFAULT_FORM);
    setSelectedGoods([]);
    setOtherGoods(['']);
    setAttachmentData(null);
    setGoodsSearch('');
    setEditingRfq(null);
    setGoodsError('');
    setAttachmentError('');
    setContactError('');
  };

  const openModal = (rfq?: RFQType) => {
    if (rfq) {
      if (!canEditRfq(rfq)) return;
      setEditingRfq(rfq);
      setFormData({
        rfq_number: rfq.rfq_number,
        company_name: rfq.company_name,
        pic_name: rfq.pic_name,
        pic_email: rfq.pic_email,
        pic_phone: rfq.pic_phone === '-' ? '-' : normalizePhoneInput(rfq.pic_phone),
      });
      setSelectedGoods(
        rfq.goods
          .filter((item) => item.type === 'existing' && item.good_id)
          .map((item) => String(item.good_id)),
      );
      setOtherGoods(rfq.goods.filter((item) => item.type === 'other' && item.name).map((item) => item.name || ''));
      setAttachmentData(null);
    } else {
      resetForm();
    }
    setGoodsSearch('');
    setContactError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const emailValue = formData.pic_email.trim();
      const phoneValue = normalizePhoneInput(formData.pic_phone);
      if (emailValue === '-' && phoneValue === '-') {
        setContactError('Provide at least one PIC contact (email or phone).');
        return;
      }
      if (!emailValue) {
        setContactError('PIC email is required. Use "-" if unavailable.');
        return;
      }
      if (!phoneValue) {
        setContactError('PIC phone is required. Use "-" if unavailable.');
        return;
      }
      if (!isValidEmail(emailValue)) {
        setContactError('Invalid PIC email format or use "-" if unavailable.');
        return;
      }
      if (!isValidPhone(phoneValue)) {
        setContactError('PIC phone must use +62 format or "-" if unavailable.');
        return;
      }

      const hasSelectedGoods = selectedGoods.length > 0;
      const hasOtherGoods = otherGoods.some((name) => name.trim().length > 0);
      if (!hasSelectedGoods && !hasOtherGoods) {
        setGoodsError('At least one item is required.');
        return;
      }
      if (!editingRfq && !attachmentData) {
        setAttachmentError('Document is required.');
        return;
      }
      setSaving(true);
      const goodsPayload = [
        ...selectedGoods.map((goodId) => ({ type: 'existing', good_id: goodId })),
        ...otherGoods
          .filter((name) => name.trim().length > 0)
          .map((name) => ({ type: 'other', name })),
      ];

      const payload = {
        ...formData,
        pic_email: emailValue,
        pic_phone: phoneValue,
        goods: goodsPayload,
        attachment_data: attachmentData,
        performed_by: profile?.id,
        performer_role: profile?.role,
      } as any;

      if (editingRfq) {
        if (!canEditRfq(editingRfq)) {
          setSaving(false);
          return;
        }
        await updateRecord<RFQType>('rfqs', editingRfq.id, payload);
      } else {
        await addRecord<RFQType>('rfqs', payload);
      }

      await fetchData();
      closeModal();
    } catch (error) {
      console.error('Failed to save RFQ', error);
    } finally {
      setSaving(false);
    }
  };

  const renderGoodsList = (rfq: RFQType) => {
    if (!rfq.goods || rfq.goods.length === 0) return 'No goods listed';
    return rfq.goods
      .map((item) => item.display_name || item.name || goods.find((g) => g.id === item.good_id)?.name || 'Item')
      .join(', ');
  };

  const filteredRfqs = rfqs.filter((rfq) => {
    const query = searchTerm.toLowerCase();
    return (
      rfq.rfq_number.toLowerCase().includes(query) ||
      rfq.company_name.toLowerCase().includes(query) ||
      renderGoodsList(rfq).toLowerCase().includes(query) ||
      (rfq.requester_name || '').toLowerCase().includes(query)
    );
  });

  const filteredGoods = goods.filter((good) => {
    const query = goodsSearch.trim().toLowerCase();
    if (!query) return true;
    return (
      good.name.toLowerCase().includes(query) ||
      good.sku.toLowerCase().includes(query) ||
      good.description.toLowerCase().includes(query) ||
      good.category.toLowerCase().includes(query) ||
      good.unit.toLowerCase().includes(query)
    );
  });
  const shouldShowGoodsList = goodsSearch.trim().length > 0;

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
          <h1 className="text-3xl font-bold text-gray-900">Request for Quotation</h1>
          <p className="text-gray-600 mt-1">RFQ entries in a concise list with modal editing.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create RFQ
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search RFQs by number, company, goods, or requester..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">RFQ</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Goods</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Requested By</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredRfqs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <FileText className="h-10 w-10 text-gray-300 mb-3" />
                      <p>No RFQs found. Create your first RFQ to get started.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRfqs.map((rfq) => (
                  <tr key={rfq.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="font-semibold">{rfq.rfq_number}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{rfq.company_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={renderGoodsList(rfq)}>
                      {renderGoodsList(rfq)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="font-medium">{rfq.requester_name || 'Unknown user'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          rfq.status,
                        )}`}
                      >
                        {rfq.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(rfq.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => setDetailRfq(rfq)}
                        className="inline-flex items-center p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition dark:text-blue-300 dark:hover:bg-blue-500/10"
                        aria-label="View RFQ details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openModal(rfq)}
                        className={`inline-flex items-center p-2 rounded-lg transition ${
                          canEditRfq(rfq)
                            ? 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10'
                            : 'text-gray-300 cursor-not-allowed dark:text-slate-600'
                        }`}
                        aria-label="Edit RFQ"
                        disabled={!canEditRfq(rfq)}
                      >
                        <Edit2 className="h-4 w-4" />
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
        <div className="fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <p className="text-sm text-gray-500 font-semibold uppercase">RFQ</p>
                <h2 className="text-xl font-bold text-gray-900">{editingRfq ? 'Edit RFQ' : 'Create RFQ'}</h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700 dark:text-slate-300 dark:hover:text-slate-100"
                aria-label="Close RFQ modal"
              >
                ✕
              </button>
            </div>

            <form className="p-6 space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    RFQ Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.rfq_number}
                    onChange={(e) => setFormData({ ...formData, rfq_number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PIC Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.pic_name}
                    onChange={(e) => setFormData({ ...formData, pic_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PIC Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.pic_email}
                    onChange={(e) => {
                      setFormData({ ...formData, pic_email: e.target.value });
                      if (contactError) setContactError('');
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="email@company.com or -"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PIC Phone <span className="text-red-500">*</span>
                  </label>
                  <div className="flex rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent overflow-hidden dark:border-slate-700">
                    <span className="px-3 py-2 bg-gray-50 text-gray-600 text-sm border-r border-gray-200">+62</span>
                    <input
                      type="tel"
                      value={formData.pic_phone === '-' ? '-' : formData.pic_phone.replace('+62', '')}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData({
                          ...formData,
                          pic_phone: value === '-' ? '-' : normalizePhoneInput(`+62${value}`),
                        });
                        if (contactError) setContactError('');
                      }}
                      className="w-full px-3 py-2 outline-none bg-white dark:bg-slate-900 dark:text-slate-100"
                      placeholder="81234567890"
                      required
                    />
                  </div>
                </div>
                {contactError && <p className="text-sm text-red-600 md:col-span-2">{contactError}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Goods <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={goodsSearch}
                        onChange={(e) => setGoodsSearch(e.target.value)}
                        placeholder="Search goods"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedGoods.length === 0 ? (
                        <span className="text-sm text-gray-500">No goods selected.</span>
                      ) : (
                        selectedGoods.map((goodId) => {
                          const good = goods.find((item) => String(item.id) === goodId);
                          if (!good) return null;
                          return (
                            <span
                              key={goodId}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-800 text-sm rounded-full border border-blue-200"
                            >
                              {good.name}
                              <button
                                type="button"
                                className="text-blue-600 hover:text-blue-800"
                                onClick={() => setSelectedGoods((prev) => prev.filter((id) => id !== goodId))}
                                aria-label={`Remove ${good.name}`}
                              >
                                ✕
                              </button>
                            </span>
                          );
                        })
                      )}
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100 max-h-40 overflow-y-auto">
                      {!shouldShowGoodsList ? (
                        <div className="p-3 text-sm text-gray-600">Type to search goods.</div>
                      ) : filteredGoods.length === 0 ? (
                        <div className="p-3 text-sm text-gray-600">
                          {goods.length === 0 ? 'No goods available.' : 'No goods match your search.'}
                        </div>
                      ) : (
                          filteredGoods.map((good) => (
                            <button
                              key={good.id}
                              type="button"
                              onClick={() => {
                                if (goodsError) setGoodsError('');
                                setSelectedGoods((prev) =>
                                  prev.includes(String(good.id)) ? prev : [...prev, String(good.id)]
                                );
                              }}
                              className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-gray-50 text-left dark:hover:bg-slate-800/60"
                            >
                              <div>
                                <span className="text-sm text-gray-800 font-medium">{good.name}</span>
                                <p className="text-xs text-gray-500">
                                  {good.sku ? `SKU ${good.sku} · ` : ''}
                                  {good.unit || '-'}
                                </p>
                              </div>
                              {selectedGoods.includes(String(good.id)) && (
                                <span className="text-xs text-blue-600 font-semibold">Selected</span>
                              )}
                            </button>
                          ))
                      )}
                    </div>
                    {goodsError && <p className="text-xs text-red-600">{goodsError}</p>}
                  </div>
                </div>

                <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Other Goods <span className="text-red-500">*</span>
                </label>
                  <div className="space-y-2">
                    {otherGoods.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => updateOtherGood(index, e.target.value)}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          placeholder="Specify other good"
                        />
                        {otherGoods.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeOtherGood(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            aria-label="Remove other good"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addOtherGood}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      + Add another item
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Attachment <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-3 p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <UploadCloud className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-800">
                      Upload supporting file <span className="text-red-500">*</span>
                    </p>
                    <p className="text-xs text-gray-500">PDF or image, max 5MB</p>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      className="mt-2"
                      onChange={handleFileChange}
                      required={!editingRfq}
                    />
                    {attachmentData && <p className="text-xs text-green-600 mt-1">File attached</p>}
                    {editingRfq?.attachment_url && !attachmentData && (
                      <a
                        href={`${apiRoot}${editingRfq.attachment_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline block mt-1"
                      >
                        View current attachment
                      </a>
                    )}
                    {attachmentError && <p className="text-xs text-red-600 mt-1">{attachmentError}</p>}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingRfq ? 'Update RFQ' : 'Save RFQ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailRfq && (
        <div className="fixed inset-0 bg-gray-900/60 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">RFQ Details</h3>
                <p className="text-sm text-gray-600">{detailRfq.rfq_number}</p>
              </div>
              <button
                onClick={() => setDetailRfq(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-slate-300 dark:hover:text-slate-100"
                aria-label="Close RFQ details"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-3 text-sm text-gray-800">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <p><span className="text-gray-500">Company:</span> {detailRfq.company_name}</p>
                <p><span className="text-gray-500">PIC:</span> {detailRfq.pic_name}</p>
                <p><span className="text-gray-500">Email:</span> {detailRfq.pic_email}</p>
                <p><span className="text-gray-500">Phone:</span> {detailRfq.pic_phone}</p>
                <p><span className="text-gray-500">Requested By:</span> {detailRfq.requester_name || 'Unknown user'}</p>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Status:</span>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                      detailRfq.status,
                    )}`}
                  >
                    {detailRfq.status}
                  </span>
                </div>
                <p><span className="text-gray-500">Created:</span> {new Date(detailRfq.created_at).toLocaleString()}</p>
              </div>

              <div>
                <p className="font-semibold text-gray-700">Goods</p>
                {detailRfq.goods && detailRfq.goods.length > 0 ? (
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    {detailRfq.goods.map((item, index) => (
                      <li key={`${item.good_id || item.name}-${index}`} className="text-gray-800">
                        {item.display_name || item.name || goods.find((g) => g.id === item.good_id)?.name || 'Item'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-600 mt-1">No goods listed.</p>
                )}
              </div>

              {detailRfq.attachment_url && (
                <div>
                  <p className="font-semibold text-gray-700">Attachment</p>
                  <a
                    href={`${apiRoot}${detailRfq.attachment_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View attached document
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
