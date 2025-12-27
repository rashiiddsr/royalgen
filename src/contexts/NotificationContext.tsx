import { createContext, useContext, ReactNode } from 'react';

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
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const value: NotificationContextValue = {
    notifications: [],
    unreadCount: 0,
    pushNotification: () => {
      // Notifications are temporarily disabled.
    },
    markAllRead: () => {
      // Notifications are temporarily disabled.
    },
    dismissNotification: () => {
      // Notifications are temporarily disabled.
    },
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
