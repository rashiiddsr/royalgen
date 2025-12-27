import { useEffect, useMemo, useState } from 'react';
import { addRecord, deleteRecordWithContext, getRecords, updateRecord } from '../../lib/api';
import { Eye, Plus, Search, Trash2, UserRound, Edit2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Client {
  id: string;
  company_name: string;
  address: string;
  phone: string;
  email: string;
  tax_id?: string | null;
  ship_addresses?: string[] | string | null;
  created_at: string;
}

type ClientFormData = Omit<Client, 'id' | 'created_at' | 'ship_addresses'> & {
  ship_addresses: string[];
  performed_by?: string | number;
};

const EMPTY_FORM: ClientFormData = {
  company_name: '',
  address: '',
  phone: '',
  email: '',
  tax_id: '',
  ship_addresses: [''],
};

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

const parseShipAddresses = (value?: string[] | string | null) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export default function Clients() {
  const { profile } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [contactError, setContactError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [formData, setFormData] = useState<ClientFormData>(EMPTY_FORM);
  const [sameAsAddress, setSameAsAddress] = useState(true);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const data = await getRecords<Client>('clients');
      const sorted = [...data]
        .map((client) => ({
          ...client,
          ship_addresses: parseShipAddresses(client.ship_addresses),
        }))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setClients(sorted);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (client?: Client) => {
    if (client) {
      const shipAddresses = parseShipAddresses(client.ship_addresses);
      const isSame = shipAddresses.length === 1 && shipAddresses[0] === client.address;
      setEditingClient(client);
      setFormData({
        company_name: client.company_name,
        address: client.address,
        phone: client.phone === '-' ? '-' : normalizePhoneInput(client.phone),
        email: client.email,
        tax_id: client.tax_id || '',
        ship_addresses: shipAddresses.length ? shipAddresses : [''],
      });
      setSameAsAddress(isSame);
    } else {
      setEditingClient(null);
      setFormData(EMPTY_FORM);
      setSameAsAddress(true);
    }
    setContactError('');
    setAddressError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingClient(null);
    setContactError('');
    setAddressError('');
  };

  const handleShipAddressChange = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      ship_addresses: prev.ship_addresses.map((item, idx) => (idx === index ? value : item)),
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setContactError('');
    setAddressError('');

    const emailValue = formData.email.trim();
    const phoneValue = normalizePhoneInput(formData.phone);
    if (!emailValue) {
      setContactError('Email is required.');
      return;
    }
    if (!phoneValue) {
      setContactError('Phone is required.');
      return;
    }
    if (!isValidEmail(emailValue)) {
      setContactError('Invalid email format.');
      return;
    }
    if (!isValidPhone(phoneValue)) {
      setContactError('Phone must use +62 format.');
      return;
    }

    const shipAddresses = sameAsAddress
      ? [formData.address.trim()]
      : formData.ship_addresses.map((item) => item.trim()).filter(Boolean);
    if (shipAddresses.length === 0) {
      setAddressError('At least one shipping address is required.');
      return;
    }

    const payload: ClientFormData = {
      ...formData,
      email: emailValue,
      phone: phoneValue,
      ship_addresses: shipAddresses.slice(0, 3),
      performed_by: profile?.id,
    };

    try {
      if (editingClient) {
        await updateRecord<Client>('clients', editingClient.id, payload as Client);
      } else {
        await addRecord<Client>('clients', payload as Client);
      }
      await fetchClients();
      closeModal();
    } catch (error) {
      console.error('Error saving client:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (profile?.role !== 'superadmin') {
      alert('Only the superadmin can delete clients.');
      return;
    }
    if (!confirm('Are you sure you want to delete this client?')) return;

    try {
      await deleteRecordWithContext('clients', id, { performed_by: profile?.id });
      fetchClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete client.');
    }
  };

  const filteredClients = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return clients.filter((client) =>
      client.company_name.toLowerCase().includes(query) ||
      client.email.toLowerCase().includes(query) ||
      client.phone.toLowerCase().includes(query)
    );
  }, [clients, searchTerm]);

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
          <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-600 mt-1">Manage company client profiles and shipping addresses</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Client
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search clients by company, email, or phone..."
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
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tax ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ship Addresses
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <UserRound className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No clients found.</p>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const shipAddresses = parseShipAddresses(client.ship_addresses);
                  return (
                    <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{client.company_name}</div>
                        <div className="text-xs text-gray-500">{client.address}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div>{client.email}</div>
                        <div className="text-xs text-gray-500">{client.phone}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{client.tax_id || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {shipAddresses.length > 0 ? `${shipAddresses.length} address(es)` : '-'}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => setDetailClient(client)}
                          className="inline-flex items-center p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          aria-label="View client"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openModal(client)}
                          className="inline-flex items-center p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                          aria-label="Edit client"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(client.id)}
                          className="inline-flex items-center p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          aria-label="Delete client"
                        >
                          <Trash2 className="h-4 w-4" />
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
          <div className="bg-white rounded-xl shadow-lg w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <p className="text-sm text-gray-500 font-semibold uppercase">Client</p>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingClient ? 'Edit Client' : 'Add Client'}
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="p-2 rounded-full hover:bg-gray-100 transition"
                aria-label="Close client modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(event) => setFormData((prev) => ({ ...prev, company_name: event.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tax ID
                  </label>
                  <input
                    type="text"
                    value={formData.tax_id || ''}
                    onChange={(event) => setFormData((prev) => ({ ...prev, tax_id: event.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.address}
                  onChange={(event) => setFormData((prev) => ({ ...prev, address: event.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                      value={formData.phone === '-' ? '-' : formData.phone.replace(/^\+62/, '')}
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          phone: event.target.value === '-' ? '-' : normalizePhoneInput(`+62${event.target.value}`),
                        }))
                      }
                      className="flex-1 px-3 py-2 focus:outline-none"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    Shipping Address <span className="text-red-500">*</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={sameAsAddress}
                      onChange={(event) => setSameAsAddress(event.target.checked)}
                    />
                    Same as address
                  </label>
                </div>
                {sameAsAddress ? (
                  <p className="mt-2 text-sm text-gray-500">
                    Shipping address will use the main address.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {[0, 1, 2].map((index) => (
                      <input
                        key={index}
                        type="text"
                        value={formData.ship_addresses[index] || ''}
                        onChange={(event) => handleShipAddressChange(index, event.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder={`Shipping address ${index + 1}`}
                      />
                    ))}
                  </div>
                )}
                {addressError && <p className="text-sm text-red-600 mt-2">{addressError}</p>}
              </div>

              {contactError && <p className="text-sm text-red-600">{contactError}</p>}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingClient ? 'Update Client' : 'Save Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <p className="text-sm text-gray-500 font-semibold uppercase">Client Details</p>
                <h2 className="text-xl font-bold text-gray-900">{detailClient.company_name}</h2>
              </div>
              <button
                onClick={() => setDetailClient(null)}
                className="p-2 rounded-full hover:bg-gray-100 transition"
                aria-label="Close client details"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">{detailClient.email}</p>
                </div>
                <div>
                  <p className="text-gray-500">Phone</p>
                  <p className="font-medium text-gray-900">{detailClient.phone}</p>
                </div>
                <div>
                  <p className="text-gray-500">Tax ID</p>
                  <p className="font-medium text-gray-900">{detailClient.tax_id || '-'}</p>
                </div>
              </div>
              <div>
                <p className="text-gray-500">Address</p>
                <p className="font-medium text-gray-900">{detailClient.address}</p>
              </div>
              <div>
                <p className="text-gray-500">Shipping Addresses</p>
                {parseShipAddresses(detailClient.ship_addresses).length === 0 ? (
                  <p className="font-medium text-gray-900">-</p>
                ) : (
                  <ul className="list-disc list-inside space-y-1 text-gray-800">
                    {parseShipAddresses(detailClient.ship_addresses).map((address, index) => (
                      <li key={`${address}-${index}`}>{address}</li>
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
