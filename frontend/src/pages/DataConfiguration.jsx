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
  
  // Field Mapping State
  const [fieldMappings, setFieldMappings] = useState([]);
  const [selectedMapping, setSelectedMapping] = useState(null);
  const [availableFields, setAvailableFields] = useState([]);
  
  // Data Flow State
  const [dataFlows, setDataFlows] = useState([]);
  
  // Integration Sources State
  const [integrationSources, setIntegrationSources] = useState([]);

  useEffect(() => {
    if (user?.role === 'super_admin') {
      loadStores();
      loadFormulas();
      loadFieldMappings();
      loadDataFlow();
      loadIntegrationSources();
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

  const loadFieldMappings = async () => {
    try {
      const response = await dataConfigurationAPI.getFieldMappings();
      setFieldMappings(response.data.mappings || []);
    } catch (error) {
      console.error('Error loading field mappings:', error);
    }
  };

  const loadDataFlow = async () => {
    try {
      const response = await dataConfigurationAPI.getDataFlow();
      setDataFlows(response.data.dataFlows || []);
    } catch (error) {
      console.error('Error loading data flow:', error);
    }
  };

  const loadIntegrationSources = async () => {
    try {
      const response = await dataConfigurationAPI.getIntegrationSources();
      setIntegrationSources(response.data.sources || []);
    } catch (error) {
      console.error('Error loading integration sources:', error);
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

  const handleEditMapping = async (mapping) => {
    setSelectedMapping(mapping);
    try {
      const response = await dataConfigurationAPI.getAvailableFields(mapping.data_type);
      setAvailableFields(response.data.fields || []);
    } catch (error) {
      console.error('Error loading available fields:', error);
    }
  };

  const handleSaveMapping = async () => {
    try {
      setLoading(true);
      await dataConfigurationAPI.updateFieldMapping(selectedMapping.id, {
        column_mapping: selectedMapping.column_mapping
      });
      alert('Field mapping saved successfully!');
      setSelectedMapping(null);
      loadFieldMappings();
    } catch (error) {
      alert('Error saving mapping: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (source) => {
    try {
      setLoading(true);
      const response = await dataConfigurationAPI.testConnection(source.id, source.source_type);
      if (response.data.success) {
        alert('Connection successful!');
      } else {
        alert('Connection failed: ' + response.data.message);
      }
    } catch (error) {
      alert('Error testing connection: ' + (error.response?.data?.error || error.message));
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
          Manage data formulas, field mappings, and integration configurations
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {[
            { id: 'form-builder', name: 'Form Builder' },
            { id: 'database-browser', name: 'Database Browser' },
            { id: 'formulas', name: 'Formulas' },
            { id: 'field-mappings', name: 'Field Mappings' },
            { id: 'data-flow', name: 'Data Flow' },
            { id: 'integration-sources', name: 'Integration Sources' }
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

      {/* Field Mappings Tab */}
      {activeTab === 'field-mappings' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Integration Field Mappings</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {fieldMappings.map(mapping => (
                  <tr key={mapping.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {mapping.store_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {mapping.data_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      Google Sheets: {mapping.sheet_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        mapping.auto_sync_enabled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {mapping.auto_sync_enabled ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEditMapping(mapping)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit Mapping
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedMapping && (
            <div className="mt-6 border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">
                Edit Field Mapping: {selectedMapping.store_name} - {selectedMapping.data_type}
              </h3>
              
              <div className="space-y-4">
                {availableFields.map(field => (
                  <div key={field.name} className="flex items-center gap-4">
                    <label className="w-48 text-sm font-medium text-gray-700">
                      {field.label} ({field.name})
                    </label>
                    <input
                      type="text"
                      value={selectedMapping.column_mapping?.[selectedMapping.data_type]?.[field.name] || ''}
                      onChange={(e) => {
                        const updated = {
                          ...selectedMapping,
                          column_mapping: {
                            ...selectedMapping.column_mapping,
                            [selectedMapping.data_type]: {
                              ...(selectedMapping.column_mapping?.[selectedMapping.data_type] || {}),
                              [field.name]: e.target.value
                            }
                          }
                        };
                        setSelectedMapping(updated);
                      }}
                      placeholder="Google Sheet column name"
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-6 flex gap-4">
                <button
                  onClick={handleSaveMapping}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Mapping
                </button>
                <button
                  onClick={() => setSelectedMapping(null)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Data Flow Tab */}
      {activeTab === 'data-flow' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Data Flow Configuration</h2>
          <p className="text-gray-600 mb-6">
            View where synced data flows to in the database
          </p>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target Table</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mapping Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dataFlows.map(flow => (
                  <tr key={flow.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {flow.store_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {flow.data_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-600">
                      {flow.target_table}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        flow.column_mapping ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {flow.column_mapping ? 'Configured' : 'Needs Mapping'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Integration Sources Tab */}
      {activeTab === 'integration-sources' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Integration Sources</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Sync</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {integrationSources.map(source => (
                  <tr key={source.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {source.source_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {source.store_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {source.data_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {source.spreadsheet_id || source.source_identifier}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {source.last_sync_at 
                        ? new Date(source.last_sync_at).toLocaleString()
                        : 'Never'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleTestConnection(source)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Test Connection
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataConfiguration;

