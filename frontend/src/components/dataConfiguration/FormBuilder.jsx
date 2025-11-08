import { useState, useEffect } from 'react';
import { dataConfigurationAPI, storesAPI } from '../../services/api';

const FormBuilder = () => {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formConfig, setFormConfig] = useState(null);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('global');
  const [loading, setLoading] = useState(false);
  
  // Form editing state
  const [editingField, setEditingField] = useState(null);
  const [editingCalculatedField, setEditingCalculatedField] = useState(null);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [showCalculatedFieldModal, setShowCalculatedFieldModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  useEffect(() => {
    loadTemplates();
    loadStores();
  }, []);

  // Auto-select "Daily Revenue Entry" when templates load
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplate) {
      const dailyRevenueTemplate = templates.find(t => t.name === 'daily_revenue');
      if (dailyRevenueTemplate) {
        setSelectedTemplate(dailyRevenueTemplate);
      }
    }
  }, [templates, selectedTemplate]);

  useEffect(() => {
    if (selectedTemplate) {
      loadFormConfig(selectedTemplate.id);
    }
  }, [selectedTemplate, selectedStore]);

  const loadTemplates = async () => {
    try {
      const response = await dataConfigurationAPI.getFormTemplates();
      setTemplates(response.data.templates || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const loadStores = async () => {
    try {
      const response = await storesAPI.getAll();
      setStores(response.data.stores || []);
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const loadFormConfig = async (templateId) => {
    try {
      setLoading(true);
      const storeId = selectedStore === 'global' ? null : selectedStore;
      const response = await dataConfigurationAPI.getFormTemplate(templateId, storeId);
      setFormConfig(response.data.configuration);
    } catch (error) {
      console.error('Error loading form config:', error);
      alert('Error loading form configuration: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveField = async (fieldData) => {
    try {
      setLoading(true);
      const fieldToSave = {
        ...fieldData,
        form_template_id: selectedTemplate.id,
        store_id: selectedStore === 'global' ? null : selectedStore
      };
      
      await dataConfigurationAPI.saveFormField(fieldToSave);
      setShowFieldModal(false);
      setEditingField(null);
      loadFormConfig(selectedTemplate.id);
      alert('Field saved successfully!');
    } catch (error) {
      alert('Error saving field: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCalculatedField = async (calcFieldData) => {
    try {
      setLoading(true);
      const fieldToSave = {
        ...calcFieldData,
        form_template_id: selectedTemplate.id,
        store_id: selectedStore === 'global' ? null : selectedStore
      };
      
      await dataConfigurationAPI.saveCalculatedField(fieldToSave);
      setShowCalculatedFieldModal(false);
      setEditingCalculatedField(null);
      loadFormConfig(selectedTemplate.id);
      alert('Calculated field saved successfully!');
    } catch (error) {
      alert('Error saving calculated field: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteField = async (fieldId) => {
    if (!confirm('Are you sure you want to delete this field?')) return;
    
    try {
      setLoading(true);
      await dataConfigurationAPI.deleteFormField(fieldId);
      loadFormConfig(selectedTemplate.id);
      alert('Field deleted successfully!');
    } catch (error) {
      alert('Error deleting field: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCalculatedField = async (fieldId) => {
    if (!confirm('Are you sure you want to delete this calculated field?')) return;
    
    try {
      setLoading(true);
      await dataConfigurationAPI.deleteCalculatedField(fieldId);
      loadFormConfig(selectedTemplate.id);
      alert('Calculated field deleted successfully!');
    } catch (error) {
      alert('Error deleting calculated field: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Group fields by field_group
  const groupedFields = formConfig?.fields.reduce((acc, field) => {
    const group = field.field_group || 'Other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(field);
    return acc;
  }, {}) || {};
  
  // Group calculated fields by field_group
  const groupedCalculatedFields = formConfig?.calculatedFields.reduce((acc, field) => {
    const group = field.field_group || 'Other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(field);
    return acc;
  }, {}) || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Form Builder</h2>
          <p className="text-gray-600 mt-1">
            Create and customize data entry forms. Changes will automatically update in admin/manager portals.
          </p>
          {selectedTemplate && (
            <p className="text-sm text-blue-600 mt-1 font-medium">
              Currently editing: {selectedTemplate.display_name}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowTemplateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + New Form Template
        </button>
      </div>

      {/* Template Selection */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Form Template
            </label>
            <select
              value={selectedTemplate?.id || ''}
              onChange={(e) => {
                const template = templates.find(t => t.id === e.target.value);
                setSelectedTemplate(template || null);
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Select a form template...</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.display_name}
                </option>
              ))}
            </select>
          </div>
          
          {selectedTemplate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Configuration Scope
              </label>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="global">Global (All Stores)</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {loading && !formConfig && (
        <div className="text-center py-8">Loading form configuration...</div>
      )}

      {formConfig && (
        <div className="space-y-6">
          {/* Form Fields */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Form Fields</h3>
              <button
                onClick={() => {
                  setEditingField(null);
                  setShowFieldModal(true);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                + Add Field
              </button>
            </div>

            {Object.keys(groupedFields).map(group => (
              <div key={group} className="mb-6">
                <h4 className="text-lg font-medium text-gray-800 mb-3 border-b pb-2">
                  {group}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupedFields[group].map(field => (
                    <div
                      key={field.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{field.field_label}</div>
                          <div className="text-sm text-gray-500 mt-1">
                            {field.field_type} • Key: {field.field_key}
                          </div>
                          {field.is_required && (
                            <span className="inline-block mt-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                              Required
                            </span>
                          )}
                          {!field.is_visible && (
                            <span className="inline-block mt-2 px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded ml-2">
                              Hidden
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingField(field);
                              setShowFieldModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteField(field.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Calculated Fields */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Calculated Fields (Daily Business Report)</h3>
              <button
                onClick={() => {
                  setEditingCalculatedField(null);
                  setShowCalculatedFieldModal(true);
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              >
                + Add Calculated Field
              </button>
            </div>

            {Object.keys(groupedCalculatedFields).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No calculated fields. Click "+ Add Calculated Field" to create one.
              </div>
            ) : (
              <div className="space-y-6">
                {Object.keys(groupedCalculatedFields).map(group => (
                  <div key={group}>
                    <h4 className="text-lg font-medium text-gray-800 mb-3 border-b pb-2">
                      {group}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {groupedCalculatedFields[group].map(calcField => (
                        <div
                          key={calcField.id}
                          className="border border-purple-200 rounded-lg p-4 bg-purple-50"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 mb-2">{calcField.field_label}</div>
                              <div className="text-sm text-gray-600 mb-2">
                                <div className="font-mono text-xs bg-white p-2 rounded border mb-2">
                                  {calcField.calculation_formula}
                                </div>
                                <div className="text-xs text-gray-500">
                                  <strong>Input Fields:</strong> {calcField.input_fields?.join(', ') || 'None'}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  <strong>Format:</strong> {calcField.format_type || 'number'}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <button
                                onClick={() => {
                                  setEditingCalculatedField(calcField);
                                  setShowCalculatedFieldModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteCalculatedField(calcField.id)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Field Modal */}
      {showFieldModal && (
        <FieldModal
          field={editingField}
          formConfig={formConfig}
          onSave={handleSaveField}
          onClose={() => {
            setShowFieldModal(false);
            setEditingField(null);
          }}
        />
      )}

      {/* Calculated Field Modal */}
      {showCalculatedFieldModal && (
        <CalculatedFieldModal
          calculatedField={editingCalculatedField}
          formConfig={formConfig}
          onSave={handleSaveCalculatedField}
          onClose={() => {
            setShowCalculatedFieldModal(false);
            setEditingCalculatedField(null);
          }}
        />
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <TemplateModal
          onSave={async (templateData) => {
            try {
              setLoading(true);
              await dataConfigurationAPI.saveFormTemplate(templateData);
              setShowTemplateModal(false);
              loadTemplates();
              alert('Form template created successfully!');
            } catch (error) {
              alert('Error creating template: ' + (error.response?.data?.error || error.message));
            } finally {
              setLoading(false);
            }
          }}
          onClose={() => setShowTemplateModal(false)}
        />
      )}
    </div>
  );
};

// Field Modal Component
const FieldModal = ({ field, formConfig, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    field_key: field?.field_key || '',
    field_label: field?.field_label || '',
    field_type: field?.field_type || 'text',
    field_group: field?.field_group || '',
    is_required: field?.is_required || false,
    is_visible: field?.is_visible !== false,
    default_value: field?.default_value || '',
    placeholder: field?.placeholder || '',
    help_text: field?.help_text || '',
    options: field?.options || [],
    display_order: field?.display_order || 0,
    ...field
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-semibold mb-4">
          {field ? 'Edit Field' : 'Add Field'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Key (Database Column)
              </label>
              <input
                type="text"
                value={formData.field_key}
                onChange={(e) => setFormData({ ...formData, field_key: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="e.g., total_cash"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Label
              </label>
              <input
                type="text"
                value={formData.field_label}
                onChange={(e) => setFormData({ ...formData, field_label: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="e.g., Total Cash"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Type
              </label>
              <select
                value={formData.field_type}
                onChange={(e) => setFormData({ ...formData, field_type: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="select">Select/Dropdown</option>
                <option value="textarea">Textarea</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Group
              </label>
              <input
                type="text"
                value={formData.field_group}
                onChange={(e) => setFormData({ ...formData, field_group: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="e.g., Daily Cash, Business Revenue"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Placeholder
              </label>
              <input
                type="text"
                value={formData.placeholder}
                onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Value
              </label>
              <input
                type="text"
                value={formData.default_value}
                onChange={(e) => setFormData({ ...formData, default_value: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Order
              </label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Help Text
            </label>
            <textarea
              value={formData.help_text}
              onChange={(e) => setFormData({ ...formData, help_text: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={2}
            />
          </div>
          
          <div className="flex items-center gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_required}
                onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                className="mr-2"
              />
              Required
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_visible}
                onChange={(e) => setFormData({ ...formData, is_visible: e.target.checked })}
                className="mr-2"
              />
              Visible
            </label>
          </div>
          
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Save Field
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Calculated Field Modal Component
const CalculatedFieldModal = ({ calculatedField, formConfig, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    field_key: calculatedField?.field_key || '',
    field_label: calculatedField?.field_label || '',
    field_group: calculatedField?.field_group || '',
    calculation_formula: calculatedField?.calculation_formula || '',
    input_fields: calculatedField?.input_fields || [],
    operation_type: calculatedField?.operation_type || 'formula',
    display_order: calculatedField?.display_order || 0,
    is_visible: calculatedField?.is_visible !== false,
    format_type: calculatedField?.format_type || 'currency',
    ...calculatedField
  });

  const availableFields = formConfig?.fields || [];
  const availableCalculatedFields = formConfig?.calculatedFields || [];
  
  // Combine regular fields and calculated fields for formula building
  const allAvailableFields = [
    ...availableFields.map(f => ({ ...f, isCalculated: false })),
    ...availableCalculatedFields
      .filter(cf => cf.id !== calculatedField?.id) // Don't include self-reference
      .map(cf => ({ 
        field_key: cf.field_key, 
        field_label: cf.field_label, 
        id: cf.id,
        isCalculated: true 
      }))
  ];
  
  const handleToggleInput = (fieldKey) => {
    const current = formData.input_fields || [];
    if (current.includes(fieldKey)) {
      setFormData({
        ...formData,
        input_fields: current.filter(f => f !== fieldKey)
      });
    } else {
      setFormData({
        ...formData,
        input_fields: [...current, fieldKey]
      });
    }
  };

  const handleInsertField = (fieldKey) => {
    const currentFormula = formData.calculation_formula || '';
    // Add with proper spacing
    const operator = currentFormula.trim() && !currentFormula.trim().endsWith('(') ? ' + ' : '';
    setFormData({
      ...formData,
      calculation_formula: currentFormula + operator + fieldKey
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-semibold mb-4">
          {calculatedField ? 'Edit Calculated Field' : 'Add Calculated Field'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Key
              </label>
              <input
                type="text"
                value={formData.field_key}
                onChange={(e) => setFormData({ ...formData, field_key: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="e.g., total_net_sales"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Label
              </label>
              <input
                type="text"
                value={formData.field_label}
                onChange={(e) => setFormData({ ...formData, field_label: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="e.g., Total Net Sales"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Group
              </label>
              <input
                type="text"
                value={formData.field_group}
                onChange={(e) => setFormData({ ...formData, field_group: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Format Type
              </label>
              <select
                value={formData.format_type}
                onChange={(e) => setFormData({ ...formData, format_type: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="currency">Currency</option>
                <option value="percentage">Percentage</option>
                <option value="number">Number</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Calculation Formula
            </label>
            <div className="mb-2 space-y-2">
              <div className="text-xs text-gray-500 mb-2">
                Available input fields (click to insert):
              </div>
              <div className="flex flex-wrap gap-2">
                {availableFields.map(field => (
                  <button
                    key={field.id}
                    type="button"
                    onClick={() => handleInsertField(field.field_key)}
                    className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded hover:bg-blue-200"
                    title={field.field_label}
                  >
                    {field.field_key}
                  </button>
                ))}
              </div>
              {availableCalculatedFields.length > 0 && (
                <>
                  <div className="text-xs text-gray-500 mb-2 mt-3">
                    Available calculated fields (can reference in formulas):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableCalculatedFields
                      .filter(cf => cf.id !== calculatedField?.id)
                      .map(calcField => (
                        <button
                          key={calcField.id}
                          type="button"
                          onClick={() => handleInsertField(calcField.field_key)}
                          className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded hover:bg-purple-200"
                          title={calcField.field_label}
                        >
                          {calcField.field_key}
                        </button>
                      ))}
                  </div>
                </>
              )}
            </div>
            <textarea
              value={formData.calculation_formula}
              onChange={(e) => setFormData({ ...formData, calculation_formula: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-sm"
              rows={3}
              placeholder="e.g., total_cash + business_credit_card - expenses"
            />
            <div className="text-xs text-gray-500 mt-1">
              Use field keys and operators: +, -, *, /, (, )
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Input Fields (which fields contribute to this calculation)
            </label>
            <div className="border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
              <div>
                <div className="text-xs font-medium text-gray-700 mb-1">Input Fields:</div>
                {availableFields.map(field => (
                  <label key={field.id} className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      checked={formData.input_fields?.includes(field.field_key)}
                      onChange={() => handleToggleInput(field.field_key)}
                      className="mr-2"
                    />
                    <span className="text-sm">{field.field_label} ({field.field_key})</span>
                  </label>
                ))}
              </div>
              {availableCalculatedFields.length > 0 && (
                <div className="border-t border-gray-300 pt-2 mt-2">
                  <div className="text-xs font-medium text-gray-700 mb-1">Calculated Fields (can also reference):</div>
                  {availableCalculatedFields
                    .filter(cf => cf.id !== calculatedField?.id)
                    .map(calcField => (
                      <label key={calcField.id} className="flex items-center mb-2">
                        <input
                          type="checkbox"
                          checked={formData.input_fields?.includes(calcField.field_key)}
                          onChange={() => handleToggleInput(calcField.field_key)}
                          className="mr-2"
                        />
                        <span className="text-sm text-purple-700">
                          {calcField.field_label} ({calcField.field_key}) - Calculated
                        </span>
                      </label>
                    ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_visible}
                onChange={(e) => setFormData({ ...formData, is_visible: e.target.checked })}
                className="mr-2"
              />
              Visible on form
            </label>
          </div>
          
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              Save Calculated Field
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Template Modal Component
const TemplateModal = ({ onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    form_type: 'revenue',
    store_specific: false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-semibold mb-4">Create Form Template</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template Name (Key)
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="e.g., daily_revenue"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="e.g., Daily Revenue Entry"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Form Type
            </label>
            <select
              value={formData.form_type}
              onChange={(e) => setFormData({ ...formData, form_type: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="revenue">Revenue</option>
              <option value="expense">Expense</option>
              <option value="lottery">Lottery</option>
              <option value="invoice">Invoice</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={3}
            />
          </div>
          
          <div className="flex items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.store_specific}
                onChange={(e) => setFormData({ ...formData, store_specific: e.target.checked })}
                className="mr-2"
              />
              Allow store-specific customization
            </label>
          </div>
          
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Template
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FormBuilder;

