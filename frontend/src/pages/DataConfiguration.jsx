import { useState, useEffect } from 'react';
import { dataConfigurationAPI, storesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import FormBuilder from '../components/dataConfiguration/FormBuilder';
import DatabaseBrowser from '../components/dataConfiguration/DatabaseBrowser';

const DataConfiguration = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('form-builder');
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('default');
  
  // Formula Management State
  const [formulas, setFormulas] = useState([]);
  const [currentFormula, setCurrentFormula] = useState(null);
  
  useEffect(() => {
    if (user?.role === 'super_admin') {
      loadStores();
      loadFormulas();
    }
  }, [user]);

  const loadStores = async () => {
    try {
      const response = await storesAPI.getAll();
      setStores(response.data.stores || []);
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const loadFormulas = async () => {
    try {
      const response = await dataConfigurationAPI.getFormulas();
      setFormulas(response.data.formulas || []);
    } catch (error) {
      console.error('Error loading formulas:', error);
    }
  };

  const loadFormula = async (storeId) => {
    try {
      setLoading(true);
      const response = await dataConfigurationAPI.getFormula(storeId === 'default' ? null : storeId);
      setCurrentFormula(response.data.formula);
    } catch (error) {
      console.error('Error loading formula:', error);
      alert('Error loading formula: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStore) {
      loadFormula(selectedStore);
    }
  }, [selectedStore]);

  const handleSaveFormula = async () => {
    try {
      setLoading(true);
      const storeId = selectedStore === 'default' ? null : selectedStore;
      await dataConfigurationAPI.updateFormula(storeId, currentFormula);
      alert('Formula saved successfully!');
      loadFormulas();
    } catch (error) {
      alert('Error saving formula: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'super_admin') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Access denied. Super admin only.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Data Configuration</h1>
        <p className="text-gray-600 mt-2">
          Manage custom forms, calculated fields, and cash drawer formulas.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {[
            { id: 'form-builder', name: 'Form Builder' },
            { id: 'database-browser', name: 'Database Browser' },
            { id: 'formulas', name: 'Formulas' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Form Builder Tab */}
      {activeTab === 'form-builder' && <FormBuilder />}

      {/* Database Browser Tab */}
      {activeTab === 'database-browser' && <DatabaseBrowser />}

      {/* Formulas Tab */}
      {activeTab === 'formulas' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Cash Drawer Calculation Formulas</h2>
            <div className="flex items-center gap-4">
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="default">Default (All Stores)</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : currentFormula ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Combined Drawer Formula (Business Cash)
                </label>
                <textarea
                  value={JSON.stringify(currentFormula.combined_drawer_formula || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setCurrentFormula({
                        ...currentFormula,
                        combined_drawer_formula: parsed
                      });
                    } catch (err) {
                      // Invalid JSON, keep as is
                    }
                  }}
                  className="w-full h-64 font-mono text-sm border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lottery Owed Formula
                </label>
                <textarea
                  value={JSON.stringify(currentFormula.lottery_owed_formula || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setCurrentFormula({
                        ...currentFormula,
                        lottery_owed_formula: parsed
                      });
                    } catch (err) {
                      // Invalid JSON
                    }
                  }}
                  className="w-full h-64 font-mono text-sm border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <button
                onClick={handleSaveFormula}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Save Formula
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No formula configuration found. Click "Save Formula" to create one.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DataConfiguration;

