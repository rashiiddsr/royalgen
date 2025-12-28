import { useState, useEffect } from 'react';
import { getRecords, updateRecord } from '../../lib/api';
import { CheckCircle, Edit2, Eye, Receipt, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';

interface InvoiceGood {
  no: number;
  goods?: string | null;
  description?: string | null;
  unit?: string | null;
  qty: number;
  price: number;
  subtotal: number;
}

interface InvoiceType {
  id: string;
  invoice_number: string;
  sales_order_id?: string | null;
  client_id?: string | null;
  company_name?: string | null;
  billing_address?: string | null;
  payment_time?: string | null;
  invoice_date?: string | null;
  total_amount: number;
  tax_amount: number;
  grand_total: number;
  status: string;
  paid_date?: string | null;
  goods?: InvoiceGood[] | null;
  created_at: string;
}

interface OrderType {
  id: string;
  order_number: string;
}

interface ClientType {
  id: string;
  company_name: string;
  address: string;
  ship_addresses?: string[] | string | null;
}

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

const formatRupiah = (value: number) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value || 0);

export default function Invoices() {
  const { profile } = useAuth();
  const { suppressNotification } = useNotifications();
  const [invoices, setInvoices] = useState<InvoiceType[]>([]);
  const [ordersById, setOrdersById] = useState<Record<string, OrderType>>({});
  const [clientsById, setClientsById] = useState<Record<string, ClientType>>({});
  const [loading, setLoading] = useState(true);
  const [detailInvoice, setDetailInvoice] = useState<InvoiceType | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceType | null>(null);
  const [editForm, setEditForm] = useState({
    payment_time: '',
    billing_address: '',
  });

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const [invoiceData, orderData, clientData] = await Promise.all([
        getRecords<InvoiceType>('invoices'),
        getRecords<OrderType>('sales_orders'),
        getRecords<ClientType>('clients'),
      ]);

      const orderMap = orderData.reduce<Record<string, OrderType>>((acc, order) => {
        acc[String(order.id)] = order;
        return acc;
      }, {});

      const clientMap = clientData.reduce<Record<string, ClientType>>((acc, client) => {
        acc[String(client.id)] = client;
        return acc;
      }, {});

      setOrdersById(orderMap);
      setClientsById(clientMap);
      setInvoices(
        invoiceData.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      );
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      paid: 'bg-green-100 text-green-800 dark:bg-emerald-500/20 dark:text-emerald-200',
      overdue: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-100';
  };

  const handleOpenEdit = (invoice: InvoiceType) => {
    setEditingInvoice(invoice);
    setEditForm({
      payment_time: invoice.payment_time || '',
      billing_address: invoice.billing_address || '',
    });
  };

  const handleEditSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingInvoice) return;

    try {
      await updateRecord<InvoiceType>('invoices', editingInvoice.id, {
        payment_time: editForm.payment_time,
        billing_address: editForm.billing_address,
        performed_by: profile?.id,
      });
      setEditingInvoice(null);
      fetchInvoices();
    } catch (error) {
      console.error('Error updating invoice:', error);
      alert('Failed to update invoice.');
    }
  };

  const handleMarkPaid = async (invoice: InvoiceType) => {
    const confirmed = window.confirm(
      'Confirm payment: ensure the data is correct and the payment has been received.',
    );
    if (!confirmed) return;

    try {
      suppressNotification('invoice_paid', String(invoice.id));
      await updateRecord<InvoiceType>('invoices', invoice.id, {
        status: 'paid',
        performed_by: profile?.id,
      });
      fetchInvoices();
      if (detailInvoice?.id === invoice.id) {
        setDetailInvoice({ ...invoice, status: 'paid' });
      }
    } catch (error) {
      console.error('Error updating invoice status:', error);
      alert('Failed to update invoice status.');
    }
  };

  const resolveAddressOptions = (invoice: InvoiceType) => {
    const client = invoice.client_id ? clientsById[String(invoice.client_id)] : null;
    const addresses = client ? [client.address, ...parseShipAddresses(client.ship_addresses)] : [];
    const unique = Array.from(new Set(addresses.filter(Boolean)));
    if (invoice.billing_address && !unique.includes(invoice.billing_address)) {
      unique.unshift(invoice.billing_address);
    }
    return unique;
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600 mt-1">Monitor invoices generated from approved sales orders</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 dark:bg-slate-800 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 dark:bg-slate-900 dark:divide-slate-800">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No invoices found.</p>
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {invoice.invoice_number}
                      </div>
                      <div className="text-sm text-gray-500">
                        {invoice.invoice_date
                          ? new Date(invoice.invoice_date).toLocaleDateString()
                          : new Date(invoice.created_at).toLocaleDateString()}
                      </div>
                      {invoice.sales_order_id && ordersById[String(invoice.sales_order_id)] && (
                        <div className="text-xs text-gray-500">
                          SO: {ordersById[String(invoice.sales_order_id)].order_number}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {invoice.company_name || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        Rp {formatRupiah(Number(invoice.grand_total) || 0)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Tax: Rp {formatRupiah(Number(invoice.tax_amount) || 0)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {invoice.payment_time || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          invoice.status,
                        )}`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => setDetailInvoice(invoice)}
                        className="inline-flex items-center p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition dark:hover:bg-slate-800/60"
                        aria-label="View invoice"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(invoice)}
                        disabled={invoice.status === 'paid'}
                        className={`inline-flex items-center p-2 rounded-lg transition ${
                          invoice.status === 'paid'
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                        }`}
                        aria-label="Edit invoice"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleMarkPaid(invoice)}
                        disabled={invoice.status !== 'overdue'}
                        className={`inline-flex items-center p-2 rounded-lg transition ${
                          invoice.status !== 'overdue'
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10'
                        }`}
                        aria-label="Mark invoice paid"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Invoice Details</h2>
                <p className="text-sm text-gray-600">{detailInvoice.invoice_number}</p>
              </div>
              <button
                onClick={() => setDetailInvoice(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500">Company</p>
                  <p className="font-medium text-gray-900">{detailInvoice.company_name || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Invoice Date</p>
                  <p className="font-medium text-gray-900">
                    {detailInvoice.invoice_date
                      ? new Date(detailInvoice.invoice_date).toLocaleDateString()
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Billing Address</p>
                  <p className="font-medium text-gray-900">{detailInvoice.billing_address || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Payment Time</p>
                  <p className="font-medium text-gray-900">{detailInvoice.payment_time || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Status</p>
                  <p className="font-medium text-gray-900">{detailInvoice.status}</p>
                </div>
                {detailInvoice.paid_date && (
                  <div>
                    <p className="text-gray-500">Paid Date</p>
                    <p className="font-medium text-gray-900">
                      {new Date(detailInvoice.paid_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <p className="font-semibold text-gray-700">Goods</p>
                {detailInvoice.goods && detailInvoice.goods.length > 0 ? (
                  <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">No</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Goods</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Description</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Unit</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Qty</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Price</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {detailInvoice.goods.map((item) => (
                          <tr key={item.no}>
                            <td className="px-3 py-2">{item.no}</td>
                            <td className="px-3 py-2">{item.goods || '-'}</td>
                            <td className="px-3 py-2">{item.description || '-'}</td>
                            <td className="px-3 py-2">{item.unit || '-'}</td>
                            <td className="px-3 py-2 text-right">{item.qty}</td>
                            <td className="px-3 py-2 text-right">Rp {formatRupiah(item.price)}</td>
                            <td className="px-3 py-2 text-right">Rp {formatRupiah(item.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-600 mt-1">No goods listed.</p>
                )}
              </div>

              <div className="flex justify-end">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between gap-6">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-medium text-gray-900">Rp {formatRupiah(detailInvoice.total_amount)}</span>
                  </div>
                  <div className="flex justify-between gap-6">
                    <span className="text-gray-500">Tax</span>
                    <span className="font-medium text-gray-900">Rp {formatRupiah(detailInvoice.tax_amount)}</span>
                  </div>
                  <div className="flex justify-between gap-6">
                    <span className="text-gray-700 font-semibold">Grand Total</span>
                    <span className="font-semibold text-gray-900">Rp {formatRupiah(detailInvoice.grand_total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Edit Invoice</h2>
                <p className="text-sm text-gray-600">{editingInvoice.invoice_number}</p>
              </div>
              <button
                onClick={() => setEditingInvoice(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Time</label>
                <input
                  type="text"
                  value={editForm.payment_time}
                  onChange={(e) => setEditForm({ ...editForm, payment_time: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="30 days after invoice"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Billing Address</label>
                <select
                  value={editForm.billing_address}
                  onChange={(e) => setEditForm({ ...editForm, billing_address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select billing address</option>
                  {resolveAddressOptions(editingInvoice).map((address) => (
                    <option key={address} value={address}>
                      {address}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Choose from the main address or ship addresses of the company.
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingInvoice(null)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
