import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { adminManagementAPI } from '../../services/api';

const SuperAdminSecurity = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      setLoading(true);
      setMessage('');
      try {
        const resp = await adminManagementAPI.getAdminConfig(user.id);
        const cfg = resp.data?.config;
        // We never fetch the actual PIN; just show whether one exists by presence of master_pin_hash on backend.
        // If config exists but we can't tell, show neutral state.
        setHasPin(!!(cfg && (cfg.master_pin_hash || cfg.master_pin_set)));
      } catch (e) {
        // If not found, treat as no pin set
        setHasPin(false);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!pin || !/^\d{4,6}$/.test(pin)) {
      setMessage('PIN must be 4–6 digits.');
      return;
    }
    try {
      setSaving(true);
      setMessage('');
      await adminManagementAPI.updateAdminConfig(user.id, { master_pin: pin });
      setHasPin(true);
      setPin('');
      setMessage('Super Admin handheld PIN saved.');
    } catch (e) {
      setMessage(e?.response?.data?.error || 'Failed to save PIN');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'super_admin') {
    return (
      <div className="p-6">
        <div className="text-gray-600">Only Super Admin can access this section.</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Super Admin Security</h2>
      <p className="text-sm text-gray-600 mb-6">
        Set or rotate the Super Admin handheld Master PIN used to unlock debug and device-wide access on handheld devices.
      </p>

      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        {loading ? (
          <div className="text-gray-500">Loading current status…</div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Master PIN status:</span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${hasPin ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {hasPin ? 'Set' : 'Not Set'}
            </span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">New Master PIN (4–6 digits)</label>
          <input
            type="password"
            inputMode="numeric"
            pattern="\\d*"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\\D/g, '').slice(0, 6))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d8659]"
            placeholder="e.g., 0419"
          />
          <p className="text-xs text-gray-500 mt-1">This overwrites the existing Master PIN.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !pin}
            className={`px-4 py-2 rounded-md text-white ${saving || !pin ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#2d8659] hover:bg-[#256b49]'}`}
          >
            {saving ? 'Saving…' : 'Save PIN'}
          </button>
          {message && <div className="text-sm text-gray-700 self-center">{message}</div>}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminSecurity;


