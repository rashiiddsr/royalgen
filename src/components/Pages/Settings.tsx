import { useEffect, useState } from 'react';
import { addRecord, getRecords, updateRecord } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';

interface CompanySetting {
  id?: string;
  company_name: string;
  company_address: string;
  tax_id: string;
  tax_rate: number | '';
  contact: string;
  logo_url?: string | null;
  language: 'indonesia' | 'english';
}

const EMPTY_SETTING: CompanySetting = {
  company_name: '',
  company_address: '',
  tax_id: '',
  tax_rate: '',
  contact: '',
  logo_url: null,
  language: 'indonesia',
};

export default function Settings() {
  const { profile } = useAuth();
  const { pushNotification } = useNotifications();
  const [settings, setSettings] = useState<CompanySetting | null>(null);
  const [formData, setFormData] = useState<CompanySetting>(EMPTY_SETTING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoData, setLogoData] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const apiRoot = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/api$/, '');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const records = await getRecords<CompanySetting>('settings');
        const current = records[0];
        if (current) {
          setSettings(current);
          setFormData({
            company_name: current.company_name || '',
            company_address: current.company_address || '',
            tax_id: current.tax_id || '',
            tax_rate: current.tax_rate ?? '',
            contact: current.contact || '',
            logo_url: current.logo_url || null,
            language: current.language || 'indonesia',
          });
          if (current.logo_url) {
            setLogoPreview(`${apiRoot}${current.logo_url}`);
          }
        }
      } catch (error) {
        console.error('Failed to fetch settings', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [apiRoot]);

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result?.toString();
      if (!result) return;
      setLogoData(result);
      setLogoPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        company_name: formData.company_name,
        company_address: formData.company_address,
        tax_id: formData.tax_id,
        tax_rate: formData.tax_rate === '' ? 0 : Number(formData.tax_rate),
        contact: formData.contact,
        language: formData.language,
      };

      if (logoData) {
        payload.logo_data = logoData;
      }

      let saved: CompanySetting | null = null;
      if (settings?.id) {
        saved = await updateRecord<CompanySetting>('settings', settings.id, payload as CompanySetting);
      } else {
        saved = await addRecord<CompanySetting>('settings', payload as CompanySetting);
      }

      if (saved) {
        setSettings(saved);
        setLogoData(null);
        if (saved.logo_url) {
          setLogoPreview(`${apiRoot}${saved.logo_url}`);
        }
      }

      pushNotification({
        title: 'Settings saved',
        message: 'Company settings have been updated.',
      });
    } catch (error) {
      console.error('Failed to save settings', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!profile || profile.role !== 'superadmin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">You do not have access to this page.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage company profile and tax preferences</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama PT</label>
            <input
              type="text"
              value={formData.company_name}
              onChange={(event) => setFormData((prev) => ({ ...prev, company_name: event.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">NPWP</label>
            <input
              type="text"
              value={formData.tax_id}
              onChange={(event) => setFormData((prev) => ({ ...prev, tax_id: event.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
          <textarea
            value={formData.company_address}
            onChange={(event) => setFormData((prev) => ({ ...prev, company_address: event.target.value }))}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Besar Pajak (%)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.tax_rate}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  tax_rate: event.target.value === '' ? '' : Number(event.target.value),
                }))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kontak</label>
            <input
              type="text"
              value={formData.contact}
              onChange={(event) => setFormData((prev) => ({ ...prev, contact: event.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bahasa</label>
            <select
              value={formData.language}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, language: event.target.value as CompanySetting['language'] }))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="indonesia">Indonesia</option>
              <option value="english">English</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo Perusahaan</label>
            <input type="file" accept="image/*" onChange={handleLogoChange} />
            <p className="text-xs text-gray-500 mt-1">Upload logo perusahaan (optional).</p>
          </div>
          {logoPreview && (
            <div className="flex items-center justify-center border border-dashed border-gray-200 rounded-lg p-3 bg-gray-50">
              <img src={logoPreview} alt="Company logo preview" className="max-h-20 object-contain" />
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
