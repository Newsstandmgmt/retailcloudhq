import { useState, useEffect } from 'react';
import { databaseBrowserAPI } from '../../services/api';

const DatabaseBrowser = () => {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableStructure, setTableStructure] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [tableRelationships, setTableRelationships] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('data'); // 'data', 'structure', 'relationships'
  
  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  
  // Filters
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  useEffect(() => {
    loadTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      loadTableStructure();
      loadTableRelationships();
      loadTableData();
    }
  }, [selectedTable, pagination.page, pagination.limit, search, sortBy, sortOrder]);

  const loadTables = async () => {
    try {
      setLoading(true);
      const response = await databaseBrowserAPI.getTables();
      setTables(response.data.tables || []);
    } catch (error) {
      console.error('Error loading tables:', error);
      alert('Error loading tables: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const loadTableStructure = async () => {
    if (!selectedTable) return;
    
    try {
      const response = await databaseBrowserAPI.getTableStructure(selectedTable);
      setTableStructure(response.data.columns || []);
    } catch (error) {
      console.error('Error loading table structure:', error);
    }
  };

  const loadTableData = async () => {
    if (!selectedTable) return;
    
    try {
      setLoading(true);
      const response = await databaseBrowserAPI.getTableData(selectedTable, {
        page: pagination.page,
        limit: pagination.limit,
        search,
        sort_by: sortBy,
        sort_order: sortOrder
      });
      
      setTableData(response.data.data || []);
      setPagination(response.data.pagination || pagination);
    } catch (error) {
      console.error('Error loading table data:', error);
      alert('Error loading table data: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const loadTableRelationships = async () => {
    if (!selectedTable) return;
    
    try {
      const response = await databaseBrowserAPI.getTableRelationships(selectedTable);
      setTableRelationships(response.data.relationships || []);
    } catch (error) {
      console.error('Error loading relationships:', error);
    }
  };

  const handleTableSelect = (tableName) => {
    setSelectedTable(tableName);
    setActiveTab('data');
    setPagination({ ...pagination, page: 1 });
    setSearch('');
  };

  const handlePageChange = (newPage) => {
    setPagination({ ...pagination, page: newPage });
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">null</span>;
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (typeof value === 'object') {
      return <code className="text-xs bg-gray-100 px-2 py-1 rounded">{JSON.stringify(value)}</code>;
    }
    return String(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Database Browser</h2>
        <p className="text-gray-600 mt-1">
          Browse all database tables, view data, and examine table structures
        </p>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Tables List */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Tables ({tables.length})</h3>
          <div className="space-y-1 max-h-[calc(100vh-250px)] overflow-y-auto">
            {loading && tables.length === 0 ? (
              <div className="text-center py-4 text-gray-500">Loading tables...</div>
            ) : (
              tables.map(table => (
                <button
                  key={table.table_name}
                  onClick={() => handleTableSelect(table.table_name)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedTable === table.table_name
                      ? 'bg-blue-100 text-blue-800 font-medium'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {table.table_name}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Table Details */}
        <div className="col-span-3 bg-white rounded-lg shadow p-6">
          {!selectedTable ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">Select a table to view its data and structure</p>
            </div>
          ) : (
            <div>
              {/* Table Header */}
              <div className="mb-4">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {selectedTable}
                </h3>
                
                {/* Tabs */}
                <div className="border-b border-gray-200 mb-4">
                  <nav className="flex space-x-8">
                    {[
                      { id: 'data', name: 'Data' },
                      { id: 'structure', name: 'Structure' },
                      { id: 'relationships', name: 'Relationships' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                          activeTab === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {tab.name}
                      </button>
                    ))}
                  </nav>
                </div>
              </div>

              {/* Data Tab */}
              {activeTab === 'data' && (
                <div>
                  {/* Search and Filters */}
                  <div className="mb-4 flex gap-4 items-center">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPagination({ ...pagination, page: 1 });
                      }}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                    />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-2"
                    >
                      {tableStructure.map(col => (
                        <option key={col.column_name} value={col.column_name}>
                          Sort by {col.column_name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
                      className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      {sortOrder === 'ASC' ? '↑' : '↓'}
                    </button>
                  </div>

                  {/* Data Table */}
                  {loading ? (
                    <div className="text-center py-8">Loading data...</div>
                  ) : tableData.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No data found
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {Object.keys(tableData[0] || {}).map(key => (
                              <th
                                key={key}
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {tableData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              {Object.entries(row).map(([key, value]) => (
                                <td
                                  key={key}
                                  className="px-4 py-3 whitespace-nowrap text-gray-900"
                                >
                                  {formatValue(value)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                        {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                        {pagination.total} entries
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePageChange(pagination.page - 1)}
                          disabled={pagination.page === 1}
                          className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          Previous
                        </button>
                        <span className="px-3 py-1 text-gray-700">
                          Page {pagination.page} of {pagination.totalPages}
                        </span>
                        <button
                          onClick={() => handlePageChange(pagination.page + 1)}
                          disabled={pagination.page >= pagination.totalPages}
                          className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Structure Tab */}
              {activeTab === 'structure' && (
                <div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Column Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Data Type
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Nullable
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Default
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {tableStructure.map((column, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-sm text-gray-900">
                              {column.column_name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {column.data_type}
                              {column.character_maximum_length && (
                                <span className="text-gray-400">
                                  ({column.character_maximum_length})
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {column.is_nullable === 'YES' ? (
                                <span className="text-green-600">Yes</span>
                              ) : (
                                <span className="text-red-600">No</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                              {column.column_default || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Relationships Tab */}
              {activeTab === 'relationships' && (
                <div>
                  {tableRelationships.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No foreign key relationships found
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Constraint Name
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Column
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              References Table
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              References Column
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {tableRelationships.map((rel, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-mono text-sm text-gray-900">
                                {rel.constraint_name}
                              </td>
                              <td className="px-4 py-3 font-mono text-sm text-gray-600">
                                {rel.column_name}
                              </td>
                              <td className="px-4 py-3 text-sm text-blue-600 hover:underline cursor-pointer"
                                  onClick={() => handleTableSelect(rel.foreign_table_name)}
                              >
                                {rel.foreign_table_name}
                              </td>
                              <td className="px-4 py-3 font-mono text-sm text-gray-600">
                                {rel.foreign_column_name}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DatabaseBrowser;

