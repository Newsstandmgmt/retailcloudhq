import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { storesAPI, storeTemplatesAPI, adminManagementAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { US_STATES } from '../utils/usStates';

const StoreForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    template_id: '',
    lottery_retailer_id: '',
    admin_id: '', // For super admin to assign admin
  });
  const [templates, setTemplates] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEdit) {
      loadStore();
    }
    if (user?.role === 'super_admin') {
      loadTemplates();
      loadAdmins();
    }
  }, [id, user]);

  const loadStore = async () => {
    try {
      const response = await storesAPI.getById(id);
      setFormData(response.data.store);
    } catch (error) {
      setError('Error loading store: ' + (error.response?.data?.error || error.message));
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await storeTemplatesAPI.getAll();
      setTemplates(response.data.templates || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const loadAdmins = async () => {
    try {
      const response = await adminManagementAPI.getAdmins();
      // Filter to only show active regular admins (exclude super_admin)
      const activeAdmins = (response.data.admins || []).filter(admin => 
        admin.is_active !== false && admin.role === 'admin' // Only regular admins, not super_admin
      );
      setAdmins(activeAdmins);
    } catch (error) {
      console.error('Error loading admins:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isEdit) {
        await storesAPI.update(id, formData);
      } else {
        await storesAPI.create(formData);
      }
      navigate('/stores');
    } catch (error) {
      console.error('Store form error:', error);
      console.error('Error response:', error.response);
      console.error('Error response data:', error.response?.data);
      const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || 'Error saving store';
      setError(errorMessage);
      alert(`Error: ${errorMessage}`); // Also show in alert for visibility
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Store' : 'Create New Store'}
        </h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Store Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {user?.role === 'super_admin' && (
            <>
              <div>
                <label htmlFor="admin_id" className="block text-sm font-medium text-gray-700">
                  Assign Admin
                </label>
                <select
                  id="admin_id"
                  name="admin_id"
                  value={formData.admin_id || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Admin (Optional)</option>
                  {admins.map(admin => (
                    <option key={admin.id} value={admin.id}>
                      {admin.first_name} {admin.last_name} ({admin.email})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Select an admin to assign this store to. If left empty, no admin will be assigned initially.
                </p>
              </div>

              <div>
                <label htmlFor="template_id" className="block text-sm font-medium text-gray-700">
                  Store Template *
                </label>
                <select
                  id="template_id"
                  name="template_id"
                  value={formData.template_id || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No Template (Basic Features Only)</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                {formData.template_id && (
                  <p className="mt-1 text-xs text-gray-500">
                    {templates.find(t => t.id === formData.template_id)?.description || ''}
                  </p>
                )}
              </div>
            </>
          )}

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">
              Address
            </label>
            <input
              type="text"
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                City
              </label>
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                State
              </label>
              <select
                id="state"
                name="state"
                value={formData.state || ''}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select State</option>
                {US_STATES.map(state => (
                  <option key={state.code} value={state.code}>
                    {state.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Selecting the state will configure lottery system settings for this location.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="zip_code" className="block text-sm font-medium text-gray-700">
                Zip Code
              </label>
              <input
                type="text"
                id="zip_code"
                name="zip_code"
                value={formData.zip_code}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {(user?.role === 'super_admin' || user?.role === 'admin') && (
            <div>
              <label htmlFor="lottery_retailer_id" className="block text-sm font-medium text-gray-700">
                Lottery Retailer ID
              </label>
              <input
                type="text"
                id="lottery_retailer_id"
                name="lottery_retailer_id"
                value={formData.lottery_retailer_id || ''}
                onChange={handleChange}
                placeholder="e.g., 780162"
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                State Lottery assigned Retailer ID for this location. Used for validating lottery reports.
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/stores')}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StoreForm;

