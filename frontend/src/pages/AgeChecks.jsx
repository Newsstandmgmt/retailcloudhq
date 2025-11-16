import React, { useEffect, useState } from 'react';
import { useStore } from '../contexts/StoreContext';
import { ageChecksAPI } from '../services/api';

export default function AgeChecks() {
  const { selectedStore } = useStore();
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [result, setResult] = useState('');
  const [limit, setLimit] = useState(200);

  const load = async () => {
    if (!selectedStore?.id) return;
    setLoading(true);
    try {
      const res = await ageChecksAPI.listByStore(selectedStore.id, {
        start: start || undefined,
        end: end || undefined,
        result: result || undefined,
        limit,
      });
      setChecks(res.data?.checks || []);
    } catch (e) {
      console.error('Load age checks failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStore?.id]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Age Checks</h1>
        <div className="flex items-center gap-2">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="border rounded px-2 py-1" />
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="border rounded px-2 py-1" />
          <select value={result} onChange={(e) => setResult(e.target.value)} className="border rounded px-2 py-1">
            <option value="">All</option>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
          </select>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="border rounded px-2 py-1">
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </select>
          <button className="px-3 py-2 bg-gray-100 rounded border" onClick={load}>Refresh</button>
        </div>
      </div>

      <div className="border rounded">
        <table className="min-w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Result</th>
              <th className="px-3 py-2">Age</th>
              <th className="px-3 py-2">DOB</th>
              <th className="px-3 py-2">Expiry</th>
              <th className="px-3 py-2">Device</th>
              <th className="px-3 py-2">Hashed ID</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="px-3 py-3 text-gray-500" colSpan={7}>Loading…</td></tr>
            )}
            {!loading && checks.map((c) => (
              <tr key={c.id} className="border-b">
                <td className="px-3 py-2 whitespace-nowrap">{new Date(c.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${c.result === 'pass' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {c.result?.toUpperCase()}
                  </span>
                </td>
                <td className="px-3 py-2">{c.age ?? '—'}</td>
                <td className="px-3 py-2">{c.dob ? new Date(c.dob).toLocaleDateString() : '—'}</td>
                <td className="px-3 py-2">{c.expiry ? new Date(c.expiry).toLocaleDateString() : '—'}</td>
                <td className="px-3 py-2">{c.device_id}</td>
                <td className="px-3 py-2">{c.id_hash || '—'}</td>
              </tr>
            ))}
            {!loading && checks.length === 0 && (
              <tr><td className="px-3 py-3 text-gray-500" colSpan={7}>No age checks found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


