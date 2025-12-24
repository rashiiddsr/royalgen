const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export type UserRole = 'staff' | 'manager' | 'admin' | 'superadmin';

export interface ActivityLog {
  id: number;
  user_id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  description?: string;
  created_at: string;
}

export interface UserProfile {
  id?: number | string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  photo_url?: string | null;
}

type TableName =
  | 'suppliers'
  | 'goods'
  | 'rfqs'
  | 'quotations'
  | 'sales_orders'
  | 'invoices'
  | 'financing'
  | 'users'
  | 'activity_logs';

type BaseRecord = { id: string | number; created_at?: string } & Record<string, unknown>;

async function handleResponse(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error || 'Request failed';
    throw new Error(message);
  }
  return data;
}

export async function getRecords<T extends BaseRecord>(table: TableName): Promise<T[]> {
  const response = await fetch(`${API_BASE_URL}/${table}`);
  return handleResponse(response);
}

export async function getRecord<T extends BaseRecord>(table: TableName, id: string | number): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/${table}/${id}`);
  return handleResponse(response);
}

export async function addRecord<T extends BaseRecord>(
  table: TableName,
  record: Omit<T, 'id' | 'created_at'> & Partial<Pick<T, 'id' | 'created_at'>>,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/${table}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
  return handleResponse(response);
}

export async function uploadUserPhoto(id: string | number, photoData: string): Promise<{ photo_url: string }> {
  const response = await fetch(`${API_BASE_URL}/users/${id}/photo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoData }),
  });
  return handleResponse(response);
}

export async function updateRecord<T extends BaseRecord>(
  table: TableName,
  id: string | number,
  updates: Partial<T>,
): Promise<T | null> {
  const response = await fetch(`${API_BASE_URL}/${table}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return handleResponse(response);
}

export async function deleteRecord(table: TableName, id: string | number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/${table}/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = data.error || 'Failed to delete record';
    throw new Error(message);
  }
}

export async function deleteRecordWithContext(
  table: TableName,
  id: string | number,
  payload: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/${table}/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = data.error || 'Failed to delete record';
    throw new Error(message);
  }
}

export async function logActivity(payload: Partial<ActivityLog>) {
  return addRecord<ActivityLog>('activity_logs', payload as ActivityLog);
}

export async function getActivityLogs(userId?: number | string) {
  const query = userId ? `?user_id=${userId}` : '';
  const response = await fetch(`${API_BASE_URL}/activity_logs${query}`);
  return handleResponse(response) as Promise<ActivityLog[]>;
}
