import { useEffect, useMemo, useState } from 'react';
import { Camera, Clock3, Mail, Save, Shield, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getRecord, updateRecord, uploadUserPhoto, UserProfile } from '../../lib/api';
import ActivityLog from './ActivityLog';

const normalizePhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits || digits === '62') return '';
  if (digits.startsWith('62')) return `+${digits}`;
  if (digits.startsWith('0')) return `+62${digits.slice(1)}`;
  return `+62${digits}`;
};

export default function Profile() {
  const { profile, setProfileState } = useAuth();
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    photo_url: '' as string | null,
  });
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showActivityLog, setShowActivityLog] = useState(false);

  const apiRoot = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/api$/, ''),
    [],
  );

  useEffect(() => {
    const loadProfile = async () => {
      if (!profile?.id) return;
      try {
        setLoading(true);
        const data = await getRecord<UserProfile>('users', profile.id);
        setFormData({
          full_name: data.full_name || '',
          email: data.email || '',
          phone: data.phone?.replace('+62', '') || '',
          password: '',
          photo_url: data.photo_url || null,
        });
        setPhotoPreview(data.photo_url ? `${apiRoot}${data.photo_url}` : null);
        setStatus(null);
      } catch (error) {
        console.error('Error loading profile', error);
        setStatus({ type: 'error', message: 'Failed to load profile.' });
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [apiRoot, profile?.id]);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result?.toString();
      if (result) {
        setPhotoData(result);
        setPhotoPreview(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile?.id) return;

    try {
      setSaving(true);
      const payload: Partial<UserProfile & { password?: string }> = {
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone ? normalizePhoneInput(`+62${formData.phone}`) : undefined,
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      const updated = await updateRecord<UserProfile>('users', profile.id, payload);
      let mergedProfile = updated;

      if (photoData) {
        const uploadResult = await uploadUserPhoto(profile.id, photoData);
        mergedProfile = { ...updated, photo_url: uploadResult.photo_url };
        setPhotoPreview(`${apiRoot}${uploadResult.photo_url}`);
        setPhotoData(null);
      }

      setProfileState({ ...profile, ...mergedProfile });
      setFormData((prev) => ({ ...prev, password: '', photo_url: mergedProfile.photo_url || null }));
      setStatus({ type: 'success', message: 'Profile updated successfully.' });
    } catch (error) {
      console.error('Error updating profile', error);
      setStatus({ type: 'error', message: 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  const avatarContent = () => {
    if (photoPreview) {
      return <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />;
    }

    const initials = formData.full_name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase())
      .slice(0, 2)
      .join('');

    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500 font-semibold">
        {initials || <UserIcon className="h-10 w-10" />}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-72">
        <div className="text-gray-600">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6 flex items-center gap-6">
        <div className="w-24 h-24 rounded-full overflow-hidden border border-gray-200 relative">
          {avatarContent()}
          <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow cursor-pointer hover:bg-blue-700">
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <Camera className="h-4 w-4" />
          </label>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-500 uppercase">Profile</p>
          <h1 className="text-2xl font-bold text-gray-900">{formData.full_name || 'User'}</h1>
          <p className="text-gray-600 flex items-center gap-2 capitalize mt-1">
            <Shield className="h-4 w-4 text-emerald-600" />
            {profile?.role}
          </p>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowActivityLog(true)}
              className="inline-flex items-center px-3 py-1.5 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
            >
              <Clock3 className="h-4 w-4 mr-2" />
              View Activity Log
            </button>
          </div>
        </div>
      </div>

      {status && (
        <div
          className={`p-4 rounded-lg border ${
            status.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {status.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
            <div className="flex items-center px-3 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
              <UserIcon className="h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-3 py-2 outline-none"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
            <div className="flex items-center px-3 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
              <Mail className="h-5 w-5 text-gray-400" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 outline-none"
                required
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
            <div className="flex rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent overflow-hidden">
              <span className="px-3 py-2 bg-gray-50 text-gray-600 text-sm border-r border-gray-200">+62</span>
              <input
                type="tel"
                inputMode="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 outline-none"
                placeholder="81234567890"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Numbers are stored with the +62 prefix.</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
            <div className="flex items-center px-3 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
              <Shield className="h-5 w-5 text-gray-400" />
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 outline-none"
                placeholder="Leave blank to keep current password"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-gray-500">Keep your profile details up to date.</div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {showActivityLog && (
        <div className="fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <p className="text-sm text-gray-500 font-semibold uppercase">Activity</p>
                <h2 className="text-xl font-bold text-gray-900">Your Activity Log</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowActivityLog(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close activity log"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <ActivityLog showHeader={false} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
