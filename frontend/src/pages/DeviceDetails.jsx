import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { mobileDevicesAPI, mobileLogsAPI, storesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const LevelBadge = ({ level }) => {
  const map = {
    error: 'bg-red-100 text-red-800',
    warn: 'bg-yellow-100 text-yellow-800',
    info: 'bg-blue-100 text-blue-800',
    debug: 'bg-gray-100 text-gray-800',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[level] || map.info}`}>{level.toUpperCase()}</span>;
};

export default function DeviceDetails() {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [device, setDevice] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [logLevel, setLogLevel] = useState('');
  const [limit, setLimit] = useState(200);
  const [reassignStoreId, setReassignStoreId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/'); // guard
      return;
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, isSuperAdmin]);

  const load = async () => {
    setLoading(true);
    try {
      const devRes = await mobileDevicesAPI.getDevice(deviceId);
      setDevice(devRes.data?.device || null);
      setDeviceName(devRes.data?.device?.device_name || '');
      if (devRes.data?.device?.store_id) {
        try {
          const s = await storesAPI.getById(devRes.data.device.store_id);
          setStore(s.data);
        } catch {}
      }
      const logsRes = await mobileLogsAPI.listByDevice(deviceId, { limit, level: logLevel || undefined });
      setLogs(logsRes.data?.logs || []);
    } catch (e) {
      console.error('Load device details failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const lastSeen = useMemo(() => {
    if (!device?.last_seen_at) return 'N/A';
    try { return new Date(device.last_seen_at).toLocaleString(); } catch { return device.last_seen_at; }
  }, [device]);

  const handleMarkWipe = async () => {
    if (!window.confirm('Mark this device to wipe local session on next check?')) return;
    await mobileDevicesAPI.markWipe(deviceId);
    await load();
  };

  const handleReassign = async () => {
    if (!reassignStoreId) {
      alert('Enter a target store ID');
      return;
    }
    if (!window.confirm('Reassign this device to the target store and wipe local session?')) return;
    await mobileDevicesAPI.reassign(deviceId, reassignStoreId, deviceName || null);
    await load();
  };

  const refreshLogs = async () => {
    const logsRes = await mobileLogsAPI.listByDevice(deviceId, { limit, level: logLevel || undefined });
    setLogs(logsRes.data?.logs || []);
  };

  // Auto-refresh logs every 5 seconds
  useEffect(() => {
    if (!deviceId || !isSuperAdmin) return;
    const interval = setInterval(() => {
      refreshLogs();
    }, 5000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, isSuperAdmin, limit, logLevel]);

  if (!isSuperAdmin) return null;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Device Details</h1>
        <button className="px-3 py-2 bg-gray-100 rounded border" onClick={load}>Refresh</button>
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="border rounded p-4">
              <h2 className="font-semibold mb-2">Summary</h2>
              <div className="space-y-1 text-sm">
                <div><span className="font-medium">Device ID:</span> {device?.device_id}</div>
                <div><span className="font-medium">Name:</span> {device?.device_name || 'N/A'}</div>
                <div><span className="font-medium">Store:</span> {store?.name || device?.store_id || 'N/A'}</div>
                <div><span className="font-medium">Active:</span> {device?.is_active ? 'Yes' : 'No'}</div>
                <div><span className="font-medium">Locked:</span> {device?.is_locked ? 'Yes' : 'No'}</div>
                <div><span className="font-medium">Require Wipe:</span> {device?.require_wipe ? 'Yes' : 'No'}</div>
                <div><span className="font-medium">Last Seen:</span> {lastSeen}</div>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">Device Name</label>
                <input className="border rounded px-2 py-1 w-full" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} />
              </div>
            </div>

            <div className="border rounded p-4">
              <h2 className="font-semibold mb-2">Actions (Super Admin)</h2>
              <div className="space-y-2">
                <button className="px-3 py-2 bg-yellow-600 text-white rounded" onClick={handleMarkWipe}>
                  Mark for Wipe
                </button>
                <div className="mt-2">
                  <label className="block text-sm font-medium mb-1">Reassign to Store ID</label>
                  <input className="border rounded px-2 py-1 w-full" placeholder="target store id" value={reassignStoreId} onChange={(e) => setReassignStoreId(e.target.value)} />
                  <button className="mt-2 px-3 py-2 bg-blue-600 text-white rounded" onClick={handleReassign}>
                    Reassign + Wipe
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="border rounded p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Device Logs</h2>
              <div className="flex items-center gap-2">
                <select value={logLevel} onChange={(e) => setLogLevel(e.target.value)} className="border rounded px-2 py-1">
                  <option value="">All</option>
                  <option value="error">Error</option>
                  <option value="warn">Warn</option>
                  <option value="info">Info</option>
                  <option value="debug">Debug</option>
                </select>
                <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="border rounded px-2 py-1">
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                </select>
                <button className="px-3 py-2 bg-gray-100 rounded border" onClick={refreshLogs}>Reload</button>
              </div>
            </div>
            <div className="max-h-[480px] overflow-auto text-sm">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b">
                    <th className="px-2 py-1">Time</th>
                    <th className="px-2 py-1">Level</th>
                    <th className="px-2 py-1">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b align-top">
                      <td className="px-2 py-1 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                      <td className="px-2 py-1"><LevelBadge level={l.level} /></td>
                      <td className="px-2 py-1 break-words">
                        <div>{l.message}</div>
                        {l.context && Object.keys(l.context || {}).length > 0 && (
                          <pre className="mt-1 bg-gray-50 rounded p-2 overflow-auto">{JSON.stringify(l.context, null, 2)}</pre>
                        )}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr><td className="px-2 py-2 text-gray-500" colSpan={3}>No logs.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


