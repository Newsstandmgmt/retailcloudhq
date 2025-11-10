import { useEffect, useMemo, useState } from 'react';
import { squareAPI } from '../../services/api';
import { useStore } from '../../contexts/StoreContext';

const getToday = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const SquareIntegrationSettings = ({ storeId: propStoreId }) => {
  const { selectedStore } = useStore();
  const activeStoreId = propStoreId || selectedStore?.id || null;

  const [status, setStatus] = useState({ connected: false });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [bulkDate, setBulkDate] = useState(getToday());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const availableLocations = useMemo(
    () => status?.connection?.available_locations || [],
    [status]
  );

  useEffect(() => {
    setBulkResult(null);
    setError('');
    setMessage('');
    setSelectedLocation('');
    if (activeStoreId) {
      loadStatus(activeStoreId);
    } else {
      setStatus({ connected: false });
    }
  }, [activeStoreId]);

  const loadStatus = async (storeId) => {
    try {
      setLoading(true);
      setError('');
      setMessage('');
      const response = await squareAPI.getStatus(storeId);
      const data = response.data || { connected: false };
      setStatus(data);
      if (data?.connection?.location_id) {
        setSelectedLocation(data.connection.location_id);
      } else if (data?.connection?.available_locations?.length === 1) {
        setSelectedLocation(data.connection.available_locations[0].id);
      }
    } catch (err) {
      console.error('Error loading Square status:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load Square status.');
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectSquare = async () => {
    if (!activeStoreId) return;
    try {
      setActionLoading(true);
      setError('');
      setMessage('');
      const response = await squareAPI.getConnectUrl(activeStoreId, selectedLocation || undefined);
      const url = response.data?.url;
      if (!url) {
        throw new Error('Unable to retrieve Square connection URL.');
      }
      window.open(url, '_blank', 'width=600,height=720');
      setMessage('Square authorization window opened. Complete the connection, then click Refresh.');
    } catch (err) {
      console.error('Error starting Square connection:', err);
      setError(err.response?.data?.error || err.message || 'Failed to start Square connection.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnectSquare = async () => {
    if (!activeStoreId) return;
    try {
      setActionLoading(true);
      setError('');
      setMessage('');
      await squareAPI.disconnect(activeStoreId);
      setMessage('Square disconnected for this store.');
      await loadStatus(activeStoreId);
    } catch (err) {
      console.error('Error disconnecting Square:', err);
      setError(err.response?.data?.error || err.message || 'Failed to disconnect Square.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveLocation = async () => {
    if (!activeStoreId || !selectedLocation) return;
    try {
      setActionLoading(true);
      setError('');
      setMessage('');
      await squareAPI.setLocation(activeStoreId, selectedLocation);
      setMessage('Square location saved.');
      await loadStatus(activeStoreId);
    } catch (err) {
      console.error('Error updating Square location:', err);
      setError(err.response?.data?.error || err.message || 'Failed to update Square location.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (!activeStoreId) return;
    await loadStatus(activeStoreId);
  };

  const handleBulkSync = async () => {
    try {
      setBulkLoading(true);
      setBulkResult(null);
      setError('');
      setMessage('');
      const response = await squareAPI.syncDailySalesBulk(bulkDate);
      setBulkResult(response.data);
      setMessage(
        response.data?.message ||
          `Processed ${response.data?.summary?.processed || 0} store(s) for ${bulkDate}.`
      );
    } catch (err) {
      console.error('Error syncing Square sales for stores:', err);
      setError(err.response?.data?.error || err.message || 'Failed to sync Square sales for stores.');
    } finally {
      setBulkLoading(false);
    }
  };

  if (!activeStoreId) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Please select a store to manage Square integration.</p>
      </div>
    );
  }

  const lastSynced = status?.connection?.last_synced_at || null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Square POS Integration</h3>
        <p className="text-sm text-gray-600 mt-1">
          Connect your Square account to automatically import daily credit card sales and fees for this store.
          Each store must authorize Square separately.
        </p>
      </div>

      {(error || message) && (
        <div className="space-y-2">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          {message && !error && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {message}
            </div>
          )}
        </div>
      )}

      <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex-1 space-y-2">
            {loading ? (
              <div className="text-sm text-gray-600">Loading Square status...</div>
            ) : status.connected ? (
              <>
                <div className="inline-flex items-center gap-2 text-green-700 font-medium">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                  Connected to Square
                </div>
                <div className="text-sm text-gray-700 space-y-1">
                  <div>Account ID: {status.connection?.account_id || '—'}</div>
                  <div>Merchant ID: {status.connection?.merchant_id || '—'}</div>
                  <div>
                    Location:{' '}
                    {status.connection?.location_id
                      ? availableLocations.find((loc) => loc.id === status.connection.location_id)
                          ?.name || status.connection.location_id
                      : 'Not selected'}
                  </div>
                  <div>
                    Last Sync:{' '}
                    {lastSynced ? new Date(lastSynced).toLocaleString() : 'Not yet synced'}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-700">
                Square has not been connected for this store. Connect to import daily credit card sales.
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <button
              type="button"
              onClick={handleConnectSquare}
              disabled={actionLoading || loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {status.connected ? 'Reconnect Square' : 'Connect Square'}
            </button>
            <button
              type="button"
              onClick={handleRefreshStatus}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
            >
              Refresh Status
            </button>
            {status.connected && (
              <button
                type="button"
                onClick={handleDisconnectSquare}
                disabled={actionLoading}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50"
              >
                Disconnect Square
              </button>
            )}
          </div>
        </div>

        {status.connected && availableLocations.length > 0 && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Square Location
            </label>
            <div className="flex flex-col md:flex-row gap-2 md:items-center">
              <select
                value={selectedLocation || ''}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full md:w-72 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Select a Square location</option>
                {availableLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name || location.id}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSaveLocation}
                disabled={!selectedLocation || actionLoading}
                className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 disabled:opacity-50"
              >
                Save Location
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Each store can be linked to a specific Square location. Please select the location that
              matches this store.
            </p>
          </div>
        )}
      </div>

      <div className="border border-gray-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-2">Bulk Fetch Credit Card Totals</h4>
        <p className="text-sm text-gray-600 mb-4">
          Fetch Square credit card sales and fees for every store you manage. Totals will be imported
          into each store&apos;s Daily Revenue entry for the selected date.
        </p>

        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Revenue Date</label>
            <input
              type="date"
              value={bulkDate}
              max={getToday()}
              onChange={(e) => setBulkDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <button
            type="button"
            onClick={handleBulkSync}
            disabled={bulkLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {bulkLoading ? 'Fetching…' : 'Fetch for All Assigned Stores'}
          </button>
        </div>

        {bulkResult && (
          <div className="mt-4 border border-green-200 bg-green-50 rounded-md p-4 text-sm text-gray-700">
            <div className="font-medium text-gray-900 mb-2">
              Summary: {bulkResult.summary?.successful || 0} success /{' '}
              {bulkResult.summary?.failed || 0} failed
            </div>
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {bulkResult.results?.map((result) => (
                <li
                  key={result.store_id}
                  className={`p-2 rounded border ${
                    result.status === 'success'
                      ? 'border-green-200 bg-white'
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="font-medium">
                    {result.store_name || result.store_id} — {result.status.toUpperCase()}
                  </div>
                  {result.status === 'success' ? (
                    <div className="text-xs text-gray-600">
                      Gross: ${parseFloat(result.totals?.gross_card_sales || 0).toFixed(2)} | Fees: $
                      {parseFloat(result.totals?.card_fees || 0).toFixed(2)} | Net: $
                      {parseFloat(result.totals?.net_card_sales || 0).toFixed(2)}
                    </div>
                  ) : (
                    <div className="text-xs text-red-600">
                      {result.message || 'Failed to fetch totals.'}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default SquareIntegrationSettings;


