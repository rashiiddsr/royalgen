import { useEffect, useMemo, useState } from 'react';
import { Download, Eye, Pencil, Plus, Search, Truck, X } from 'lucide-react';
import { addRecord, getRecords, updateRecord } from '../../lib/api';
import { openPrintWindow } from '../../lib/print';
import { useAuth } from '../../contexts/AuthContext';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

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
  client_id?: string | null;
  company_name?: string;
  ship_address?: string | null;
  notes?: string | null;
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
  client_id?: string | null;
  company_name?: string;
  goods?: SalesOrderGood[] | string | null;
  status: string;
}

interface ClientOption {
  id: string;
  company_name: string;
  address: string;
  phone: string;
  email: string;
  tax_id?: string | null;
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
  logo_url?: string | null;
}

const EMPTY_FORM = {
  delivery_number: '',
  delivery_date: '',
  sales_order_id: '',
  client_id: '',
  company_name: '',
  ship_address: '',
  notes: '',
};

export default function DeliveryOrders() {
  const { profile } = useAuth();
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [goodsRows, setGoodsRows] = useState<DeliveryGood[]>([]);
  const [usersById, setUsersById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [detailDelivery, setDetailDelivery] = useState<DeliveryOrder | null>(null);
  const [editingDelivery, setEditingDelivery] = useState<DeliveryOrder | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [companySettings, setCompanySettings] = useState<CompanySetting | null>(null);
  const apiRoot = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/api$/, '');

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

  const formatDateInput = (value?: string | null) => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (char) => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return map[char] || char;
    });

  const formatShortDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const buildDeliveryOrderTemplate = (delivery: DeliveryOrder, settingsOverride?: CompanySetting | null) => {
    const settings = settingsOverride ?? companySettings;
    const order = orderMap.get(String(delivery.sales_order_id));
    const goodsList = Array.isArray(delivery.goods) ? delivery.goods : [];
    const logoSrc = settings?.logo_url ? `${apiRoot}${settings.logo_url}` : '';
    const defaultNotes = [
      'Harap periksa barang yang diterima sesuai dengan detail yang tercantum di atas.',
      'Segera laporkan kepada kami jika terdapat ketidaksesuaian atau kerusakan barang dalam waktu 1x24 jam setelah barang diterima.',
    ];
    const notesList = [...defaultNotes];
    if (delivery.notes) {
      notesList.push(`Catatan tambahan: ${delivery.notes}`);
    }
    const rowsHtml = goodsList
      .map((row, index) => {
        const qty = Number(row.qty) || 0;
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(row.name || '-')}</td>
            <td>${escapeHtml(row.description || '-')}</td>
            <td>${escapeHtml(row.unit || '-')}</td>
            <td style="text-align:right;">${qty}</td>
          </tr>
        `;
      })
      .join('');

    return `
      <!doctype html>
      <html lang="id">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(delivery.delivery_number || 'Delivery Order')}.pdf</title>
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
            .logo-block { display: flex; flex-direction: column; gap: 12px; align-items: center; text-align: center; }
            .logo { max-height: 80px; max-width: 180px; width: auto; object-fit: contain; display: block; }
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
            .notes { margin-top: 24px; font-size: 13px; }
            .notes h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.18em; color: var(--muted); }
            .notes ol { margin: 0; padding-left: 18px; }
            .notes li { margin-bottom: 6px; text-align: justify; text-justify: inter-word; }
            .signature { margin-top: 36px; display: flex; justify-content: space-between; gap: 40px; font-size: 13px; }
            .signature .box { width: 45%; text-align: center; border-top: 1px solid var(--border); padding-top: 12px; }
            .signature .name { margin-top: 66px; font-weight: 600; }
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
                <h1>Delivery Order</h1>
                <div class="doc-meta">
                  <div><span>No</span><strong>${escapeHtml(delivery.delivery_number || '-')}</strong></div>
                  <div><span>Tanggal</span><strong>${formatShortDate(delivery.delivery_date)}</strong></div>
                  <div><span>Sales Order</span><strong>${escapeHtml(order?.po_number || order?.order_number || '-')}</strong></div>
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
                <p class="name">${escapeHtml(delivery.company_name || order?.company_name || '-')}</p>
                <p>${escapeHtml(delivery.ship_address || '-')}</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 40px;">No</th>
                  <th>Barang</th>
                  <th>Deskripsi</th>
                  <th style="width: 60px;">Unit</th>
                  <th style="width: 60px; text-align:right;">Qty</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || `<tr><td colspan="5" style="text-align:center;">Tidak ada barang</td></tr>`}
              </tbody>
            </table>

            <div class="notes">
              <h3>Catatan</h3>
              <ol>
                ${notesList.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}
              </ol>
            </div>

            <div class="signature">
              <div class="box">
                <div>Pengirim,</div>
                <div class="name">....................</div>
              </div>
              <div class="box">
                <div>Penerima,</div>
                <div class="name">....................</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const handleDownloadDeliveryOrder = async (delivery: DeliveryOrder) => {
    const settingsData = await getRecords<CompanySetting>('settings');
    const latestSettings = settingsData[0] || null;
    setCompanySettings(latestSettings);
    const html = buildDeliveryOrderTemplate(delivery, latestSettings);
    try {
      openPrintWindow(html);
    } catch (error) {
      console.error('Failed to open delivery order document', error);
      alert('Failed to open document. Please allow pop-ups and try again.');
    }
  };

  const fetchData = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    try {
      if (!silent) {
        setLoading(true);
      }
      const [deliveryData, orderData, userData, clientData, settingsData] = await Promise.all([
        getRecords<DeliveryOrder>('delivery_orders'),
        getRecords<SalesOrder>('sales_orders'),
        getRecords<{ id: string; full_name?: string; email?: string }>('users'),
        getRecords<ClientOption>('clients'),
        getRecords<CompanySetting>('settings'),
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
      setClients(clientData);
      setCompanySettings(settingsData[0] || null);
    } catch (error) {
      console.error('Error fetching delivery orders:', error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useAutoRefresh({
    onRefresh: () => fetchData({ silent: true }),
    pause: showModal || Boolean(detailDelivery),
  });

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
      const match = delivery.delivery_number?.match(
        /^(\d{4})\/RGI\/DO\/[IVXLCDM]+\/(\d{4})(?:-(\d+))?$/
      );
      if (!match || Number(match[2]) !== year) return max;
      const sequence = Number(match[1]);
      return Number.isNaN(sequence) ? max : Math.max(max, sequence);
    }, 0);
    const nextSequence = String(maxSequence + 1).padStart(4, '0');
    return `${nextSequence}/RGI/DO/${romanMonth}/${year}`;
  };

  const parseDeliveryNumber = (value?: string | null) => {
    if (!value) {
      return { base: '', suffix: null as number | null };
    }
    const match = value.match(/^(\d{4}\/RGI\/DO\/[IVXLCDM]+\/\d{4})(?:-(\d+))?$/);
    if (!match) {
      return { base: value, suffix: null as number | null };
    }
    return { base: match[1], suffix: match[2] ? Number(match[2]) : null };
  };

  const resolveBaseDeliveryNumber = (salesOrderId: string) => {
    const orderDeliveries = deliveries
      .filter((delivery) => String(delivery.sales_order_id) === String(salesOrderId))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    if (orderDeliveries.length === 0) {
      return getNextDeliveryNumber();
    }
    const { base } = parseDeliveryNumber(orderDeliveries[0].delivery_number);
    return base || getNextDeliveryNumber();
  };

  const resolveNextDeliverySuffix = (salesOrderId: string, baseNumber: string) => {
    const orderDeliveries = deliveries.filter(
      (delivery) => String(delivery.sales_order_id) === String(salesOrderId)
    );
    const maxSuffix = orderDeliveries.reduce((max, delivery) => {
      const parsed = parseDeliveryNumber(delivery.delivery_number);
      if (parsed.base !== baseNumber || !parsed.suffix) return max;
      return Math.max(max, parsed.suffix);
    }, 0);
    return maxSuffix + 1;
  };

  const isDeliveryComplete = (rows: DeliveryGood[]) => {
    if (rows.length === 0) return false;
    return rows.every((row) => {
      const remaining = Number(row.remaining_qty) || 0;
      const shipped = Number(row.qty) || 0;
      return shipped >= remaining;
    });
  };

  const computeDeliveryNumber = (salesOrderId: string, rows: DeliveryGood[]) => {
    if (!salesOrderId) return getNextDeliveryNumber();
    const orderDeliveries = deliveries.filter(
      (delivery) => String(delivery.sales_order_id) === String(salesOrderId)
    );
    const baseNumber = resolveBaseDeliveryNumber(salesOrderId);
    const hasShipmentQty = rows.some((row) => Number(row.qty) > 0);
    const completeNow = isDeliveryComplete(rows);
    if (orderDeliveries.length === 0) {
      if (!hasShipmentQty || completeNow) {
        return baseNumber;
      }
    }
    const nextSuffix = resolveNextDeliverySuffix(salesOrderId, baseNumber);
    return `${baseNumber}-${nextSuffix}`;
  };

  const computeDeliveryNumberForEdit = (delivery: DeliveryOrder, rows: DeliveryGood[]) => {
    const salesOrderId = String(delivery.sales_order_id || '');
    const baseNumber =
      parseDeliveryNumber(delivery.delivery_number).base || resolveBaseDeliveryNumber(salesOrderId);
    const otherDeliveries = deliveries.filter(
      (item) =>
        String(item.sales_order_id) === salesOrderId && String(item.id) !== String(delivery.id)
    );
    const hasShipmentQty = rows.some((row) => Number(row.qty) > 0);
    const completeNow = isDeliveryComplete(rows);

    if (otherDeliveries.length === 0) {
      if (!hasShipmentQty || completeNow) {
        return baseNumber;
      }
      return `${baseNumber}-1`;
    }

    return delivery.delivery_number || baseNumber;
  };

  const openCreateModal = () => {
    setEditingDelivery(null);
    setFormData({
      ...EMPTY_FORM,
      delivery_number: getNextDeliveryNumber(),
    });
    setGoodsRows([]);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingDelivery(null);
    setFormData(EMPTY_FORM);
    setGoodsRows([]);
  };

  const buildShippedMap = (orderId: string, excludeDeliveryId?: string) => {
    const shippedMap: Record<string, number> = {};
    deliveries
      .filter((delivery) => String(delivery.sales_order_id) === String(orderId))
      .filter((delivery) => (excludeDeliveryId ? String(delivery.id) !== String(excludeDeliveryId) : true))
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
    const client = clients.find((item) => String(item.id) === String(order?.client_id));
    const clientShipAddresses = client ? parseShipAddresses(client.ship_addresses) : [];
    const resolvedShipAddresses =
      clientShipAddresses.length > 0
        ? clientShipAddresses
        : client?.address
          ? [client.address]
          : [];
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

    const nextDeliveryNumber = computeDeliveryNumber(salesOrderId, filteredRemaining);

    setFormData((prev) => ({
      ...prev,
      sales_order_id: salesOrderId,
      client_id: order?.client_id || '',
      company_name: order?.company_name || client?.company_name || '',
      ship_address: resolvedShipAddresses[0] || '',
      notes: '',
      delivery_number: nextDeliveryNumber,
    }));
    setGoodsRows(filteredRemaining);
  };

  const handleGoodsQtyChange = (index: number, value: string) => {
    setGoodsRows((prev) => {
      const nextRows = prev.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const qty = value === '' ? '' : Number(value);
        return { ...row, qty };
      });
      if (!editingDelivery && formData.sales_order_id) {
        const nextNumber = computeDeliveryNumber(formData.sales_order_id, nextRows);
        setFormData((current) => ({
          ...current,
          delivery_number: nextNumber,
        }));
      }
      return nextRows;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.delivery_date) {
      alert('Tanggal delivery wajib diisi.');
      return;
    }

    if (!formData.sales_order_id) {
      alert('Pilih sales order terlebih dahulu.');
      return;
    }

    if (!formData.ship_address) {
      alert('Pilih alamat pengiriman terlebih dahulu.');
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
      const computedNumber = editingDelivery
        ? computeDeliveryNumberForEdit(editingDelivery, goodsRows)
        : computeDeliveryNumber(formData.sales_order_id, goodsRows);
      if (editingDelivery) {
        await updateRecord<DeliveryOrder>('delivery_orders', editingDelivery.id, {
          delivery_date: formData.delivery_date,
          delivery_number: computedNumber,
          sales_order_id: formData.sales_order_id,
          client_id: formData.client_id,
          company_name: formData.company_name,
          goods: payloadGoods,
          ship_address: formData.ship_address,
          notes: formData.notes || null,
          performed_by: profile?.id,
        } as DeliveryOrder);
      } else {
        await addRecord<DeliveryOrder>('delivery_orders', {
          delivery_number: computedNumber,
          delivery_date: formData.delivery_date,
          sales_order_id: formData.sales_order_id,
          client_id: formData.client_id,
          company_name: formData.company_name,
          ship_address: formData.ship_address,
          goods: payloadGoods,
          notes: formData.notes || null,
          created_by: profile?.id,
        });
      }
      setShowModal(false);
      setFormData(EMPTY_FORM);
      setEditingDelivery(null);
      await fetchData();
    } catch (error) {
      console.error('Failed to save delivery order', error);
      alert('Failed to save delivery order. Please try again.');
    }
  };

  const openDetail = (delivery: DeliveryOrder) => {
    setDetailDelivery(delivery);
  };

  const orderMap = useMemo(
    () => new Map(salesOrders.map((order) => [String(order.id), order])),
    [salesOrders]
  );

  const canEditDelivery = (delivery: DeliveryOrder) => {
    const order = orderMap.get(String(delivery.sales_order_id));
    if (!order) return false;
    return !['waiting payment', 'done'].includes(order.status);
  };

  const openEditModal = (delivery: DeliveryOrder) => {
    if (!canEditDelivery(delivery)) {
      alert('Delivery order cannot be edited once the sales order is approved or done.');
      return;
    }
    const order = orderMap.get(String(delivery.sales_order_id));
    const client = clients.find((item) => String(item.id) === String(order?.client_id));
    const clientShipAddresses = client ? parseShipAddresses(client.ship_addresses) : [];
    const resolvedAddresses =
      clientShipAddresses.length > 0
        ? clientShipAddresses
        : client?.address
          ? [client.address]
          : [];
    const shippedMap = buildShippedMap(delivery.sales_order_id, delivery.id);
    const orderGoods = parseGoods(order?.goods) as SalesOrderGood[];
    const orderedMap = orderGoods.reduce<Record<string, number>>((acc, item) => {
      const key = item.good_id ? `id:${item.good_id}` : `name:${item.name}`;
      acc[key] = (acc[key] || 0) + (Number(item.qty) || 0);
      return acc;
    }, {});
    const maxMap = Object.keys(orderedMap).reduce<Record<string, number>>((acc, key) => {
      acc[key] = Math.max((orderedMap[key] || 0) - (shippedMap[key] || 0), 0);
      return acc;
    }, {});
    const deliveryGoods = parseGoods(delivery.goods).map((row) => {
      const key = row.good_id ? `id:${row.good_id}` : `name:${row.name}`;
      return {
        ...row,
        remaining_qty: maxMap[key] ?? 0,
        qty: row.qty ?? '',
      };
    });

    setEditingDelivery(delivery);
    setFormData({
      delivery_number: delivery.delivery_number,
      delivery_date: formatDateInput(delivery.delivery_date),
      sales_order_id: delivery.sales_order_id,
      client_id: order?.client_id || delivery.client_id || '',
      company_name: delivery.company_name || order?.company_name || '',
      ship_address: delivery.ship_address || resolvedAddresses[0] || '',
      notes: delivery.notes || '',
    });
    setGoodsRows(deliveryGoods);
    setShowModal(true);
  };

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

  const selectedOrder = salesOrders.find((order) => String(order.id) === String(formData.sales_order_id));
  const selectedClient = clients.find((client) => String(client.id) === String(formData.client_id));
  const shipAddresses = selectedClient ? parseShipAddresses(selectedClient.ship_addresses) : [];
  const resolvedShipAddresses =
    shipAddresses.length > 0 ? shipAddresses : selectedClient?.address ? [selectedClient.address] : [];
  const shipAddressOptions = useMemo(() => {
    const options = new Set<string>();
    if (formData.ship_address) {
      options.add(formData.ship_address);
    }
    resolvedShipAddresses.forEach((address) => {
      if (address) options.add(address);
    });
    return Array.from(options);
  }, [formData.ship_address, resolvedShipAddresses]);
  const isEditing = Boolean(editingDelivery);

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
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"
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
                    <tr key={delivery.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
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
                        <button
                          onClick={() => openEditModal(delivery)}
                          className={`inline-flex items-center p-2 rounded-lg transition ${
                            canEditDelivery(delivery)
                              ? 'text-emerald-600 hover:bg-emerald-50'
                              : 'text-gray-300 cursor-not-allowed'
                          }`}
                          aria-label="Edit delivery order"
                          disabled={!canEditDelivery(delivery)}
                        >
                          <Pencil className="h-4 w-4" />
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
                <h2 className="text-xl font-bold text-gray-900">
                  {isEditing ? 'Edit Delivery Order' : 'Create Delivery Order'}
                </h2>
              </div>
              <button
                onClick={closeModal}
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
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                      isEditing ? 'bg-gray-50 cursor-not-allowed' : ''
                    }`}
                    required
                    disabled={isEditing}
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ship Address <span className="text-red-500">*</span>
                  </label>
                  {shipAddressOptions.length > 1 ? (
                    <select
                      value={formData.ship_address}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, ship_address: event.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    >
                      <option value="">Select ship address</option>
                      {shipAddressOptions.map((address, index) => (
                        <option key={`${address}-${index}`} value={address}>
                          {address}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.ship_address}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, ship_address: event.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Enter ship address"
                      required
                    />
                  )}
                  {!selectedOrder && (
                    <p className="text-xs text-gray-500 mt-1">Select a sales order to load ship address.</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catatan (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Tambahkan catatan tambahan jika diperlukan"
                />
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
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {isEditing ? 'Update Delivery Order' : 'Save Delivery Order'}
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadDeliveryOrder(detailDelivery)}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  <Download className="h-4 w-4" />
                  View Document
                </button>
                <button
                  onClick={() => setDetailDelivery(null)}
                  className="p-2 rounded-full hover:bg-gray-100 transition"
                  aria-label="Close delivery order details"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>
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
                  <p className="text-gray-500">Ship Address</p>
                  <p className="font-medium text-gray-900">
                    {detailDelivery.ship_address ||
                      clients.find((client) => String(client.id) === String(detailDelivery.client_id))?.address ||
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
                <p className="text-gray-500">Catatan</p>
                <p className="font-medium text-gray-900">{detailDelivery.notes || '-'}</p>
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
