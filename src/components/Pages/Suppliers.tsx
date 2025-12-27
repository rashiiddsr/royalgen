import { useState, useEffect } from 'react';
import { addRecord, deleteRecordWithContext, getRecords, updateRecord } from '../../lib/api';
import { Plus, Edit2, Trash2, Search, Eye } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';

interface Supplier {
  id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  tax_id: string;
  payment_terms: string;
  status: string;
  created_at: string;
}

type SupplierFormData = Omit<Supplier, 'id' | 'created_at'> & { performed_by?: string | number };
interface Good {
  id: string;
  name: string;
  sku?: string;
  suppliers?: { id: string | number; name: string }[];
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);
  const [contactError, setContactError] = useState('');
  const [goods, setGoods] = useState<Good[]>([]);
  const [showGoodsModal, setShowGoodsModal] = useState(false);
  const [formData, setFormData] = useState<SupplierFormData>({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Indonesia',
    tax_id: '',
    payment_terms: 'Net 30',
    status: 'active',
  });
  const { profile } = useAuth();
  const { pushNotification } = useNotifications();

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

  const canManageStatus =
    !!editingSupplier && ['admin', 'superadmin', 'manager'].includes(profile?.role ?? '');
  const canDeleteSupplier = profile?.role === 'superadmin';

  useEffect(() => {
    fetchSuppliers();
    fetchGoods();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const data = await getRecords<Supplier>('suppliers');
      const sorted = [...data].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setSuppliers(sorted);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGoods = async () => {
    try {
      const data = await getRecords<Good>('goods');
      setGoods(data);
    } catch (error) {
      console.error('Error fetching goods:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const emailValue = formData.email.trim();
      const phoneValue = normalizePhoneInput(formData.phone);
      if (emailValue === '-' && phoneValue === '-') {
        setContactError('Provide at least one contact (email or phone).');
        return;
      }
      if (!emailValue) {
        setContactError('Email is required. Use "-" if unavailable.');
        return;
      }
      if (!phoneValue) {
        setContactError('Phone is required. Use "-" if unavailable.');
        return;
      }
      if (!isValidEmail(emailValue)) {
        setContactError('Invalid email format or use "-" if unavailable.');
        return;
      }
      if (!isValidPhone(phoneValue)) {
        setContactError('Phone must use +62 format or "-" if unavailable.');
        return;
      }

      const payload: SupplierFormData = {
        ...formData,
        email: emailValue,
        phone: phoneValue,
        country: 'Indonesia',
        performed_by: profile?.id,
      };

      if (editingSupplier) {
        await updateRecord<Supplier>('suppliers', editingSupplier.id, payload as Supplier);
        pushNotification({
          title: 'Supplier updated',
          message: `${formData.name} has been updated.`,
        });
      } else {
        await addRecord<Supplier>('suppliers', payload as Supplier);
        pushNotification({
          title: 'Supplier created',
          message: `${formData.name} has been added.`,
        });
      }

      await fetchSuppliers();
      closeModal();
    } catch (error) {
      console.error('Error saving supplier:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canDeleteSupplier) {
      alert('Only the superadmin can delete suppliers.');
      return;
    }
    if (!confirm('Are you sure you want to delete this supplier?')) return;

    try {
      await deleteRecordWithContext('suppliers', id, { performed_by: profile?.id });
      fetchSuppliers();
    } catch (error) {
      console.error('Error deleting supplier:', error);
    }
  };

  const openModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        contact_person: supplier.contact_person,
        email: supplier.email,
        phone: supplier.phone === '-' ? '-' : normalizePhoneInput(supplier.phone),
        address: supplier.address,
        city: supplier.city,
        country: 'Indonesia',
        tax_id: supplier.tax_id,
        payment_terms: supplier.payment_terms,
        status: supplier.status,
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        name: '',
        contact_person: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        country: 'Indonesia',
        tax_id: '',
        payment_terms: 'Net 30',
        status: 'active',
      });
    }
    setContactError('');
    setShowGoodsModal(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSupplier(null);
    setContactError('');
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const linkedGoods = detailSupplier
    ? goods.filter((good) =>
        (good.suppliers || []).some((supplier) => String(supplier.id) === String(detailSupplier.id))
      )
    : [];

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
          <h1 className="text-3xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-gray-600 mt-1">Manage your supplier relationships</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Supplier
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search suppliers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Terms
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
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No suppliers found. Add your first supplier to get started.
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{supplier.name}</div>
                      <div className="text-sm text-gray-500">{supplier.tax_id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{supplier.contact_person}</div>
                      <div className="text-sm text-gray-500">{supplier.email}</div>
                      <div className="text-sm text-gray-500">{supplier.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{supplier.city}</div>
                      <div className="text-sm text-gray-500">{supplier.country}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{supplier.payment_terms}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          supplier.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {supplier.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => setDetailSupplier(supplier)}
                        className="inline-flex items-center p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition"
                        aria-label="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openModal(supplier)}
                        className="inline-flex items-center p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {canDeleteSupplier && (
                        <button
                          onClick={() => handleDelete(supplier.id)}
                          className="inline-flex items-center p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supplier Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Person <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (contactError) setContactError('');
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="email@company.com or -"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <div className="flex rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent overflow-hidden">
                    <span className="px-3 py-2 bg-gray-50 text-gray-600 text-sm border-r border-gray-200">+62</span>
                    <input
                      type="tel"
                      value={formData.phone === '-' ? '-' : formData.phone.replace('+62', '')}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData({ ...formData, phone: value === '-' ? '-' : normalizePhoneInput(`+62${value}`) });
                        if (contactError) setContactError('');
                      }}
                      className="w-full px-3 py-2 outline-none"
                      placeholder="81234567890"
                      required
                    />
                  </div>
                </div>
                {contactError && (
                  <div className="md:col-span-2 text-sm text-red-600">{contactError}</div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <input
                    type="text"
                    value="Indonesia"
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
                  <input
                    type="text"
                    value={formData.tax_id}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Terms
                  </label>
                  <select
                    value={formData.payment_terms}
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 45">Net 45</option>
                    <option value="Net 60">Net 60</option>
                    <option value="Net 90">Net 90</option>
                    <option value="COD">Cash on Delivery</option>
                  </select>
                </div>

                {canManageStatus && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {editingSupplier ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailSupplier && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Supplier Details</h3>
                <p className="text-sm text-gray-600">Full profile for {detailSupplier.name}</p>
              </div>
              <button
                onClick={() => {
                  setDetailSupplier(null);
                  setShowGoodsModal(false);
                }}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close details"
              >
                ✕
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-800">
              <div>
                <p className="font-semibold text-gray-700">Company Name</p>
                <p>{detailSupplier.name}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Contact Person</p>
                <p>{detailSupplier.contact_person}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Email</p>
                <p>{detailSupplier.email || '-'}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Phone</p>
                <p>{detailSupplier.phone}</p>
              </div>
              <div className="md:col-span-2">
                <p className="font-semibold text-gray-700">Address</p>
                <p>{detailSupplier.address || '-'}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">City</p>
                <p>{detailSupplier.city || '-'}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Country</p>
                <p>{detailSupplier.country}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Tax ID</p>
                <p>{detailSupplier.tax_id || '-'}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Payment Terms</p>
                <p>{detailSupplier.payment_terms}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Status</p>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    detailSupplier.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {detailSupplier.status}
                </span>
              </div>
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={() => setShowGoodsModal((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                  View Goods Linked
                </button>
              </div>
            </div>
            {showGoodsModal && (
              <div className="border-t border-gray-200 px-6 py-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Goods Linked</h4>
                {linkedGoods.length === 0 ? (
                  <p className="text-sm text-gray-500">No goods linked to this supplier.</p>
                ) : (
                  <ul className="space-y-2 text-sm text-gray-700">
                    {linkedGoods.map((good) => (
                      <li
                        key={good.id}
                        className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{good.name}</p>
                          <p className="text-xs text-gray-500">{good.sku || '-'}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
