import { createContext, useContext, ReactNode, useEffect, useRef, useState } from 'react';
import { getRecords } from '../lib/api';
import { useAuth } from './AuthContext';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  pushNotification: (notification: Omit<NotificationItem, 'id' | 'read' | 'createdAt'>) => void;
  markAllRead: () => void;
  dismissNotification: (id: string) => void;
  suppressNotification: (type: 'invoice_paid', id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

interface RfqRecord {
  id: string | number;
  rfq_number: string;
  company_name?: string;
  status: string;
  created_at: string;
  performed_by?: number | null;
}

interface QuotationRecord {
  id: string | number;
  quotation_number: string;
  status: string;
  created_at: string;
  performed_by?: number | null;
}

interface SalesOrderRecord {
  id: string | number;
  order_number: string;
  status: string;
  created_at: string;
  created_by?: number | null;
}

interface DeliveryOrderRecord {
  id: string | number;
  delivery_number: string;
  created_at: string;
  created_by?: number | null;
}

interface InvoiceRecord {
  id: string | number;
  invoice_number: string;
  status: string;
  created_at: string;
}

type SnapshotMap<T extends { id: string | number }> = Record<
  string,
  T & { id: string | number; status?: string }
>;

interface NotificationSnapshot {
  rfqs: SnapshotMap<RfqRecord>;
  quotations: SnapshotMap<QuotationRecord>;
  salesOrders: SnapshotMap<SalesOrderRecord>;
  deliveryOrders: SnapshotMap<DeliveryOrderRecord>;
  invoices: SnapshotMap<InvoiceRecord>;
}

interface NotificationSuppression {
  invoice_paid: string[];
}

const buildSnapshotMap = <T extends { id: string | number }>(records: T[]) =>
  records.reduce<SnapshotMap<T>>((acc, record) => {
    acc[String(record.id)] = record;
    return acc;
  }, {});

const getStorageKey = (prefix: string, userId?: string | number) =>
  `${prefix}:${userId ?? 'guest'}`;

const loadStorage = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const saveStorage = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const snapshotRef = useRef<NotificationSnapshot | null>(null);

  const notificationKey = getStorageKey('rgi.notifications', profile?.id);
  const snapshotKey = getStorageKey('rgi.notificationSnapshot', profile?.id);
  const suppressionKey = getStorageKey('rgi.notificationSuppression', profile?.id);

  useEffect(() => {
    if (!profile?.id) {
      setNotifications([]);
      snapshotRef.current = null;
      return;
    }
    setNotifications(loadStorage<NotificationItem[]>(notificationKey, []));
    snapshotRef.current = loadStorage<NotificationSnapshot | null>(snapshotKey, null);
  }, [notificationKey, profile?.id, snapshotKey]);

  const pushNotification = (notification: Omit<NotificationItem, 'id' | 'read' | 'createdAt'>) => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const item: NotificationItem = {
      ...notification,
      id,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => {
      const next = [item, ...prev];
      saveStorage(notificationKey, next);
      return next;
    });
  };

  const markAllRead = () => {
    setNotifications((prev) => {
      const next = prev.map((item) => ({ ...item, read: true }));
      saveStorage(notificationKey, next);
      return next;
    });
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => {
      const next = prev.filter((item) => item.id !== id);
      saveStorage(notificationKey, next);
      return next;
    });
  };

  const suppressNotification = (type: 'invoice_paid', id: string) => {
    if (!profile?.id) return;
    const current = loadStorage<NotificationSuppression>(suppressionKey, { invoice_paid: [] });
    const next = {
      ...current,
      [type]: Array.from(new Set([...(current[type] || []), String(id)])),
    } as NotificationSuppression;
    saveStorage(suppressionKey, next);
  };

  useEffect(() => {
    if (!profile?.id) return;
    let isMounted = true;

    const refreshNotifications = async () => {
      try {
        const [rfqs, quotations, salesOrders, deliveryOrders, invoices] = await Promise.all([
          getRecords<RfqRecord>('rfqs'),
          getRecords<QuotationRecord>('quotations'),
          getRecords<SalesOrderRecord>('sales_orders'),
          getRecords<DeliveryOrderRecord>('delivery_orders'),
          getRecords<InvoiceRecord>('invoices'),
        ]);

        if (!isMounted) return;

        const nextSnapshot: NotificationSnapshot = {
          rfqs: buildSnapshotMap(rfqs),
          quotations: buildSnapshotMap(quotations),
          salesOrders: buildSnapshotMap(salesOrders),
          deliveryOrders: buildSnapshotMap(deliveryOrders),
          invoices: buildSnapshotMap(invoices),
        };

        const previous = snapshotRef.current;
        if (!previous) {
          snapshotRef.current = nextSnapshot;
          saveStorage(snapshotKey, nextSnapshot);
          return;
        }

        const role = profile.role;
        const isManager = role === 'manager' || role === 'superadmin';

        rfqs.forEach((rfq) => {
          if (previous.rfqs[String(rfq.id)]) return;
          if (rfq.performed_by && String(rfq.performed_by) === String(profile.id)) return;
          pushNotification({
            title: 'New RFQ',
            message: `RFQ ${rfq.rfq_number} from ${rfq.company_name || 'client'} was created.`,
          });
        });

        quotations.forEach((quotation) => {
          const previousQuotation = previous.quotations[String(quotation.id)];
          const isCreator = quotation.performed_by && String(quotation.performed_by) === String(profile.id);
          if (!previousQuotation) {
            if (!isCreator) {
              if (isManager && quotation.status === 'waiting') {
                pushNotification({
                  title: 'Quotation awaiting approval',
                  message: `Quotation ${quotation.quotation_number} is waiting for approval.`,
                });
              } else {
                pushNotification({
                  title: 'New quotation',
                  message: `Quotation ${quotation.quotation_number} was created.`,
                });
              }
            }
            return;
          }

          if (previousQuotation.status && previousQuotation.status !== quotation.status) {
            const status = quotation.status;
            const notifyForStatus =
              ['process', 'success', 'renegotiation', 're-negotiating', 'negotiation', 'reject', 'rejected'].includes(
                status
              );
            if (notifyForStatus && (isCreator || isManager)) {
              const statusLabel =
                status === 'process'
                  ? 'approved'
                  : status === 'success'
                    ? 'success'
                    : status === 'reject' || status === 'rejected'
                      ? 'rejected'
                      : status;
              pushNotification({
                title: 'Quotation update',
                message: `Quotation ${quotation.quotation_number} is ${statusLabel}.`,
              });
            }
          }
        });

        salesOrders.forEach((order) => {
          const previousOrder = previous.salesOrders[String(order.id)];
          const isCreator = order.created_by && String(order.created_by) === String(profile.id);
          if (!previousOrder) {
          if (!isCreator) {
            pushNotification({
              title: 'New sales order',
              message: `Sales order ${order.order_number} was created.`,
            });
          }
          return;
          }
          if (previousOrder.status && previousOrder.status !== order.status) {
            if (order.status === 'waiting approval' && isManager) {
              pushNotification({
                title: 'Sales order awaiting approval',
                message: `Sales order ${order.order_number} is waiting for approval.`,
              });
            }
          }
        });

        deliveryOrders.forEach((delivery) => {
          if (previous.deliveryOrders[String(delivery.id)]) return;
          const isCreator = delivery.created_by && String(delivery.created_by) === String(profile.id);
          if (isCreator) return;
          pushNotification({
            title: 'New delivery order',
            message: `Delivery order ${delivery.delivery_number} was created.`,
          });
        });

        const suppression = loadStorage<NotificationSuppression>(suppressionKey, { invoice_paid: [] });
        const nextSuppression = { ...suppression, invoice_paid: [...(suppression.invoice_paid || [])] };
        invoices.forEach((invoice) => {
          const previousInvoice = previous.invoices[String(invoice.id)];
          if (!previousInvoice || previousInvoice.status === invoice.status) return;
          if (invoice.status === 'paid') {
            const suppressIndex = nextSuppression.invoice_paid.indexOf(String(invoice.id));
            if (suppressIndex >= 0) {
              nextSuppression.invoice_paid.splice(suppressIndex, 1);
              return;
            }
            pushNotification({
              title: 'Invoice paid',
              message: `Invoice ${invoice.invoice_number} has been paid.`,
            });
          }
        });
        saveStorage(suppressionKey, nextSuppression);

        snapshotRef.current = nextSnapshot;
        saveStorage(snapshotKey, nextSnapshot);
      } catch (error) {
        console.error('Failed to refresh notifications', error);
      }
    };

    refreshNotifications();
    const interval = window.setInterval(refreshNotifications, 15000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [profile?.id, profile?.role, snapshotKey, suppressionKey]);

  const unreadCount = notifications.filter((item) => !item.read).length;

  const value: NotificationContextValue = {
    notifications,
    unreadCount,
    pushNotification,
    markAllRead,
    dismissNotification,
    suppressNotification,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
