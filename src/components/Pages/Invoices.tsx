import { useState, useEffect } from 'react';
import { getRecords, updateRecord } from '../../lib/api';
import { CheckCircle, Download, Edit2, Eye, Receipt, Search, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { openPrintWindow } from '../../lib/print';

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

interface CompanySetting {
  id: string;
  company_name?: string | null;
  company_address?: string | null;
  director_name?: string | null;
  tax_id?: string | null;
  email?: string | null;
  phone?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  logo_url?: string | null;
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
  const [searchTerm, setSearchTerm] = useState('');
  const [detailInvoice, setDetailInvoice] = useState<InvoiceType | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceType | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySetting | null>(null);
  const apiRoot = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/api$/, '');
  const [editForm, setEditForm] = useState({
    payment_time: '',
    billing_address: '',
  });

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    try {
      if (!silent) {
        setLoading(true);
      }
      const [invoiceData, orderData, clientData, settingsData] = await Promise.all([
        getRecords<InvoiceType>('invoices'),
        getRecords<OrderType>('sales_orders'),
        getRecords<ClientType>('clients'),
        getRecords<CompanySetting>('settings'),
      ]);

      const orderMap = orderData.reduce<Record<string, OrderType>>((acc, order) => {
        acc[String(order.id)] = order;
        return acc;
      }, {});

      const clientMap = clientData.reduce<Record<string, ClientType>>((acc, client) => {
        acc[String(client.id)] = client;
        return acc;
      }, {});

      const parsedInvoices = invoiceData.map((invoice) => ({
        ...invoice,
        goods: parseInvoiceGoods(invoice.goods),
      }));

      setOrdersById(orderMap);
      setClientsById(clientMap);
      setCompanySettings(settingsData[0] || null);
      setInvoices(
        parsedInvoices.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      );
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useAutoRefresh({
    onRefresh: () => fetchInvoices({ silent: true }),
    pause: Boolean(detailInvoice) || Boolean(editingInvoice),
  });

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const formatShortDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const formatTerbilang = (value: number) => {
    const units = [
      '',
      'satu',
      'dua',
      'tiga',
      'empat',
      'lima',
      'enam',
      'tujuh',
      'delapan',
      'sembilan',
      'sepuluh',
      'sebelas',
    ];

    const toWords = (num: number): string => {
      if (num === 0) return '';
      if (num < 12) return units[num];
      if (num < 20) return `${units[num - 10]} belas`;
      if (num < 100) {
        const remainder = num % 10;
        return `${units[Math.floor(num / 10)]} puluh${remainder ? ` ${toWords(remainder)}` : ''}`;
      }
      if (num < 200) return `seratus${num % 100 ? ` ${toWords(num - 100)}` : ''}`;
      if (num < 1000) {
        const remainder = num % 100;
        return `${units[Math.floor(num / 100)]} ratus${remainder ? ` ${toWords(remainder)}` : ''}`;
      }
      if (num < 2000) return `seribu${num % 1000 ? ` ${toWords(num - 1000)}` : ''}`;
      if (num < 1_000_000) {
        const remainder = num % 1000;
        return `${toWords(Math.floor(num / 1000))} ribu${remainder ? ` ${toWords(remainder)}` : ''}`;
      }
      if (num < 1_000_000_000) {
        const remainder = num % 1_000_000;
        return `${toWords(Math.floor(num / 1_000_000))} juta${
          remainder ? ` ${toWords(remainder)}` : ''
        }`;
      }
      if (num < 1_000_000_000_000) {
        const remainder = num % 1_000_000_000;
        return `${toWords(Math.floor(num / 1_000_000_000))} milyar${
          remainder ? ` ${toWords(remainder)}` : ''
        }`;
      }
      const remainder = num % 1_000_000_000_000;
      return `${toWords(Math.floor(num / 1_000_000_000_000))} triliun${
        remainder ? ` ${toWords(remainder)}` : ''
      }`;
    };

    if (!Number.isFinite(value)) return '-';
    if (value === 0) return 'nol';
    return toWords(Math.floor(Math.abs(value))).trim();
  };

  const parseInvoiceGoods = (value?: InvoiceGood[] | string | null) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? (parsed as InvoiceGood[]) : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const buildInvoiceTemplate = (invoice: InvoiceType, settingsOverride?: CompanySetting | null) => {
    const settings = settingsOverride ?? companySettings;
    const goodsList = parseInvoiceGoods(invoice.goods);
    const logoSrc = settings?.logo_url ? `${apiRoot}${settings.logo_url}` : '';
    const taxRate = Number(settings?.tax_rate) || 0;
    const totalTagihan = Number(invoice.grand_total) || 0;
    const paymentTimeLine = invoice.payment_time
      ? `Tempo pembayaran: ${escapeHtml(invoice.payment_time)} hari setelah tanggal invoice.`
      : 'Tempo pembayaran: -';
    const rowsHtml = goodsList
      .map((row, index) => {
        const qty = Number(row.qty) || 0;
        const price = Number(row.price) || 0;
        const subtotal = Number(row.subtotal) || qty * price;
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(row.goods || '-')}</td>
            <td>${escapeHtml(row.description || '-')}</td>
            <td>${escapeHtml(row.unit || '-')}</td>
            <td style="text-align:right;">${qty}</td>
            <td style="text-align:right;">Rp ${formatRupiah(price)}</td>
            <td style="text-align:right;">Rp ${formatRupiah(subtotal)}</td>
          </tr>
        `;
      })
      .join('');

    return `
      <!doctype html>
      <html lang="id">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(invoice.invoice_number || 'Invoice')}.pdf</title>
          <style>
            :root {
              --ink: #0f172a;
              --muted: #6b7280;
              --border: #e5e7eb;
              --accent: #2563eb;
              --accent-soft: #eff6ff;
            }
            * { box-sizing: border-box; }
            @page { size: A4; margin: 20mm; }
            body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; margin: 0; color: var(--ink); background: #ffffff; font-size: 14px; font-weight: 500; }
            .page { padding: 0; }
            .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
            .logo-block { display: flex; flex-direction: column; gap: 12px; }
            .logo { max-height: 64px; object-fit: contain; }
            .logo-placeholder { width: 64px; height: 64px; border-radius: 14px; background: var(--accent-soft); display: flex; align-items: center; justify-content: center; color: var(--accent); }
            .logo-placeholder svg { width: 32px; height: 32px; }
            .brand-name { font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; }
            .doc-title { text-align: right; min-width: 220px; }
            .doc-title h1 { margin: 0; font-size: 30px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #111827; }
            .doc-meta { margin-top: 10px; display: grid; gap: 6px; font-size: 12px; color: var(--muted); }
            .doc-meta div { display: flex; justify-content: space-between; gap: 16px; }
            .address-grid { margin-top: 28px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px; }
            .address-grid h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.18em; color: var(--muted); }
            .address-card { padding: 12px 0; }
            .address-card p { margin: 4px 0; }
            .address-card .name { font-weight: 600; color: #111827; }
            table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 13px; }
            th { background: var(--accent); color: #ffffff; padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }
            td { padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
            tr:nth-child(even) td { background: #f9fafb; }
            .summary-grid { margin-top: 24px; display: grid; grid-template-columns: 1fr 0.8fr; gap: 32px; }
            .payment { font-size: 13px; }
            .payment h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.18em; color: var(--muted); }
            .payment p { margin: 4px 0; }
            .payment .tempo { font-weight: 600; color: #1f2937; }
            .terbilang { margin-top: 12px; padding: 10px 12px; border-radius: 10px; background: var(--accent-soft); color: #1e3a8a; font-style: italic; }
            .totals { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; font-size: 13px; }
            .totals-row { display: flex; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--border); }
            .totals-row:last-child { border-bottom: none; background: var(--accent-soft); font-weight: 600; }
            .signature { margin-top: 36px; display: flex; justify-content: flex-end; text-align: right; font-size: 13px; }
            .signature .name { margin-top: 58px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="top">
              <div class="logo-block">
                ${
                  logoSrc
                    ? `<img class="logo" src="${logoSrc}" alt="Company logo" />`
                    : `<div class="logo-placeholder" aria-label="Company logo">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                          <path d="M3 10.5L12 4l9 6.5"></path>
                          <path d="M5.5 9.5V20h13V9.5"></path>
                          <path d="M9 20v-5h6v5"></path>
                        </svg>
                      </div>`
                }
                <div class="brand-name">${escapeHtml(settings?.company_name || 'Company')}</div>
              </div>
              <div class="doc-title">
                <h1>Invoice</h1>
                <div class="doc-meta">
                  <div><span>No</span><strong>${escapeHtml(invoice.invoice_number || '-')}</strong></div>
                  <div><span>Tanggal</span><strong>${formatShortDate(invoice.invoice_date || invoice.created_at)}</strong></div>
                  <div><span>Sales Order</span><strong>${escapeHtml(ordersById[String(invoice.sales_order_id || '')]?.order_number || '-')}</strong></div>
                </div>
              </div>
            </div>

            <div class="address-grid">
              <div class="address-card">
                <h3>Dari</h3>
                <p class="name">${escapeHtml(settings?.company_name || 'Company')}</p>
                <p>${escapeHtml(settings?.company_address || '-')}</p>
                <p>Email ${escapeHtml(settings?.email || '-')}</p>
                <p>Telepon ${escapeHtml(settings?.phone || '-')}</p>
                <p>NPWP ${escapeHtml(settings?.tax_id || '-')}</p>
              </div>
              <div class="address-card">
                <h3>Kepada</h3>
                <p class="name">${escapeHtml(invoice.company_name || '-')}</p>
                <p>${escapeHtml(invoice.billing_address || '-')}</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 40px;">No</th>
                  <th>Barang</th>
                  <th>Deskripsi</th>
                  <th style="width: 60px;">Unit</th>
                  <th style="width: 56px; text-align:right;">Qty</th>
                  <th style="width: 110px; text-align:right;">Harga</th>
                  <th style="width: 120px; text-align:right;">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || `<tr><td colspan="7" style="text-align:center;">Tidak ada barang</td></tr>`}
              </tbody>
            </table>

            <div class="summary-grid">
              <div class="payment">
                <h3>Instruksi Pembayaran</h3>
                <p class="tempo">${paymentTimeLine}</p>
                <p>Bank: ${escapeHtml(settings?.bank_name || '-')}</p>
                <p>No. Rekening: ${escapeHtml(settings?.bank_account || '-')}</p>
                <div class="terbilang">
                  <strong>Terbilang:</strong> ${escapeHtml(formatTerbilang(totalTagihan))} rupiah
                </div>
              </div>
              <div class="totals">
                <div class="totals-row"><span>Subtotal</span><strong>Rp ${formatRupiah(Number(invoice.total_amount) || 0)}</strong></div>
                <div class="totals-row"><span>Pajak (${taxRate.toFixed(2)}%)</span><strong>Rp ${formatRupiah(Number(invoice.tax_amount) || 0)}</strong></div>
                <div class="totals-row"><span>Total Tagihan</span><strong>Rp ${formatRupiah(totalTagihan)}</strong></div>
              </div>
            </div>

            <div class="signature">
              <div>
                <div>Hormat kami,</div>
                <div class="name">${escapeHtml(settings?.director_name || '-')}</div>
                <div>${escapeHtml(settings?.company_name || '')}</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const handleDownloadInvoice = async (invoice: InvoiceType) => {
    const settingsData = await getRecords<CompanySetting>('settings');
    const latestSettings = settingsData[0] || null;
    setCompanySettings(latestSettings);
    const html = buildInvoiceTemplate(invoice, latestSettings);
    const opened = openPrintWindow(html);
    if (!opened) {
      console.error('Failed to open invoice document');
      alert('Failed to open document. Please allow pop-ups and try again.');
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

  const filteredInvoices = invoices.filter((invoice) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    const orderNumber = ordersById[String(invoice.sales_order_id || '')]?.order_number || '';
    return (
      invoice.invoice_number?.toLowerCase().includes(query) ||
      orderNumber.toLowerCase().includes(query) ||
      invoice.company_name?.toLowerCase().includes(query) ||
      invoice.status?.toLowerCase().includes(query) ||
      invoice.payment_time?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600 mt-1">Monitor invoices generated from approved sales orders</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search invoices by number, sales order, company, status, or payment time..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"
        />
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
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No invoices found.</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadInvoice(detailInvoice)}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  <Download className="h-4 w-4" />
                  View Document
                </button>
                <button
                  onClick={() => setDetailInvoice(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
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
