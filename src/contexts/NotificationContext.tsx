import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  pushNotification: (notification: Omit<NotificationItem, 'id' | 'read' | 'createdAt'>) => void;
  markAllRead: () => void;
  dismissNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);
const STORAGE_KEY = 'rgi.notifications';

const loadNotifications = () => {
  if (typeof window === 'undefined') return [] as NotificationItem[];
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [] as NotificationItem[];
    const parsed = JSON.parse(stored) as NotificationItem[];
    if (!Array.isArray(parsed)) return [] as NotificationItem[];
    return parsed;
  } catch {
    return [] as NotificationItem[];
  }
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => loadNotifications());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );

  const pushNotification = (notification: Omit<NotificationItem, 'id' | 'read' | 'createdAt'>) => {
    const now = new Date();
    const newItem: NotificationItem = {
      ...notification,
      id: `${now.getTime()}-${Math.random().toString(16).slice(2)}`,
      createdAt: now.toISOString(),
      read: false,
    };
    setNotifications((prev) => [newItem, ...prev].slice(0, 50));
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  };

  const value = useMemo(
    () => ({ notifications, unreadCount, pushNotification, markAllRead, dismissNotification }),
    [notifications, unreadCount]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
