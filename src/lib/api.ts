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
  username?: string | null;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  photo_url?: string | null;
}

type TableName =
  | 'clients'
  | 'suppliers'
  | 'goods'
  | 'goods_categories'
  | 'goods_units'
  | 'rfqs'
  | 'quotations'
  | 'sales_orders'
  | 'delivery_orders'
  | 'invoices'
  | 'settings'
  | 'users'
  | 'activity_logs';

type DocumentType = 'quotations' | 'delivery_orders' | 'invoices' | 'sales_orders';

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
  const response = await fetch(`${API_BASE_URL}/${table}`, {
    headers: {},
  });
  return handleResponse(response);
}

export async function getRecord<T extends BaseRecord>(table: TableName, id: string | number): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/${table}/${id}`, {
    headers: {},
  });
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
    headers: {},
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
  const response = await fetch(`${API_BASE_URL}/activity_logs${query}`, {
    headers: {},
  });
  return handleResponse(response) as Promise<ActivityLog[]>;
}

export async function generateDocumentPdf(
  type: DocumentType,
  id: string | number,
  html: string,
  filename?: string,
): Promise<{ blob: Blob }> {
  const response = await fetch(`${API_BASE_URL}/documents/${type}/${id}/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, filename }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = data?.error || 'Request failed';
    throw new Error(message);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/pdf')) {
    const payload = await response.text().catch(() => '');
    throw new Error(payload || 'Invalid PDF response');
  }
  const buffer = await response.arrayBuffer();
  if (!buffer.byteLength) {
    throw new Error('Empty PDF response');
  }
  const blob = new Blob([buffer], { type: 'application/pdf' });
  return { blob };
}

export function downloadFileBlob(blob: Blob, filename: string) {
  const safeName = filename.replace(/[^\w.-]+/g, '_') || 'document';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadPdfBlob(blob: Blob, filename: string) {
  const safeName = filename.replace(/[^\w.-]+/g, '_') || 'document';
  downloadFileBlob(blob, `${safeName}.pdf`);
}
