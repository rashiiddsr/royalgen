import { useEffect, useState } from 'react';
import { addRecord, getRecords, updateRecord } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

interface CompanySetting {
  id?: string;
  company_name: string;
  company_address: string;
  tax_id: string;
  tax_rate: number | '';
  email: string;
  phone: string;
  bank_name: string;
  bank_account: string;
  logo_url?: string | null;
}

const EMPTY_SETTING: CompanySetting = {
  company_name: 'PT Royal General Indonesia',
  company_address:
    'Jl. Desa Harapan No. 47 RT/RW 004/001 Kel. Air Jamban, Kec. Mandau, Kab. Bengkalis, Prov. Riau 28784',
  tax_id: '',
  tax_rate: 11,
  email: 'royalgeneralindonesia@gmail.com',
  phone: '+6282170179410',
  bank_name: '',
  bank_account: '',
  logo_url: null,
};

const normalizePhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return `+${digits}`;
  return `+62${digits}`;
};

const isValidPhone = (value: string) => /^\+62\d{6,}$/.test(value);

export default function Settings() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<CompanySetting | null>(null);
  const [formData, setFormData] = useState<CompanySetting>(EMPTY_SETTING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoData, setLogoData] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const apiRoot = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/api$/, '');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const records = await getRecords<CompanySetting>('settings');
        const current = records[0];
        if (current) {
          setSettings(current);
          setFormData({
            company_name: current.company_name || EMPTY_SETTING.company_name,
            company_address: current.company_address || EMPTY_SETTING.company_address,
            tax_id: current.tax_id || '',
            tax_rate: current.tax_rate ?? EMPTY_SETTING.tax_rate,
            email: current.email || EMPTY_SETTING.email,
            phone: normalizePhoneInput(current.phone || EMPTY_SETTING.phone),
            bank_name: current.bank_name || '',
            bank_account: current.bank_account || '',
            logo_url: current.logo_url || null,
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
    setFormError(null);
    try {
      const normalizedPhone = normalizePhoneInput(formData.phone);
      const requiredFields = [
        formData.company_name.trim(),
        formData.company_address.trim(),
        formData.email.trim(),
        normalizedPhone.trim(),
        formData.bank_name.trim(),
        formData.bank_account.trim(),
      ];
      if (requiredFields.some((field) => field.length === 0)) {
        setFormError('Please complete all required fields before saving.');
        setSaving(false);
        return;
      }
      if (!isValidPhone(normalizedPhone)) {
        setFormError('Phone number must use +62 format.');
        setSaving(false);
        return;
      }
      if (formData.tax_rate === '' || Number.isNaN(Number(formData.tax_rate))) {
        setFormError('Tax rate is required.');
        setSaving(false);
        return;
      }

      const payload: Record<string, unknown> = {
        company_name: formData.company_name,
        company_address: formData.company_address,
        tax_id: formData.tax_id,
        tax_rate: formData.tax_rate === '' ? 0 : Number(formData.tax_rate),
        email: formData.email,
        phone: normalizedPhone,
        bank_name: formData.bank_name,
        bank_account: formData.bank_account,
        performed_by: profile?.id,
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
      setShowSuccessModal(true);
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.company_name}
              onChange={(event) => setFormData((prev) => ({ ...prev, company_name: event.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tax ID
            </label>
            <input
              type="text"
              value={formData.tax_id}
              onChange={(event) => setFormData((prev) => ({ ...prev, tax_id: event.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.company_address}
            onChange={(event) => setFormData((prev) => ({ ...prev, company_address: event.target.value }))}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tax Rate (%) <span className="text-red-500">*</span>
            </label>
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
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone <span className="text-red-500">*</span>
            </label>
            <div className="flex rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent overflow-hidden">
              <span className="px-3 py-2 bg-gray-50 text-gray-600 text-sm border-r border-gray-200">+62</span>
              <input
                type="tel"
                value={formData.phone.replace(/^\+62/, '')}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    phone: normalizePhoneInput(`+62${event.target.value}`),
                  }))
                }
                className="flex-1 px-3 py-2 focus:outline-none"
                required
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bank Type <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.bank_name}
              onChange={(event) => setFormData((prev) => ({ ...prev, bank_name: event.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bank Account Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.bank_account}
              onChange={(event) => setFormData((prev) => ({ ...prev, bank_account: event.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Logo</label>
            <input type="file" accept="image/*" onChange={handleLogoChange} />
            <p className="text-xs text-gray-500 mt-1">
              Upload a company logo (optional). Recommended size: 500 x 500 px.
            </p>
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
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-900">Settings Updated</h3>
            <p className="text-sm text-gray-600 mt-2">
              Company settings have been updated successfully.
            </p>
            <button
              type="button"
              onClick={() => setShowSuccessModal(false)}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
