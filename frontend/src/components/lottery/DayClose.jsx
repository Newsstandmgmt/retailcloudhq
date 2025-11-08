import { useState, useEffect } from 'react';
import { lotteryAPI } from '../../services/api';

const DayClose = ({ storeId }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadPreview();
  }, [storeId, date]);

  const loadPreview = async () => {
    if (!date) return;
    setLoading(true);
    try {
      const response = await lotteryAPI.previewDayClose(storeId, date);
      setPreview(response.data);
    } catch (error) {
      console.error('Error loading preview:', error);
      setAlert({ type: 'error', message: 'Failed to load day close preview' });
    } finally {
      setLoading(false);
    }
  };

  const handlePostGL = async () => {
    if (!window.confirm('Are you sure you want to post GL entries for this day? This action cannot be undone.')) {
      return;
    }

    setPosting(true);
    try {
      const response = await lotteryAPI.postGL(storeId, date);
      setAlert({ type: 'success', message: 'GL entries posted successfully' });
      loadPreview();
    } catch (error) {
      console.error('Error posting GL:', error);
      setAlert({ 
        type: 'error', 
        message: error.response?.data?.error || 'Failed to post GL entries' 
      });
    } finally {
      setPosting(false);
    }
  };

  const handleResolveAnomaly = async (anomalyId, note) => {
    try {
      await lotteryAPI.resolveAnomaly(anomalyId, { resolved_note: note });
      setAlert({ type: 'success', message: 'Anomaly resolved successfully' });
      loadPreview();
    } catch (error) {
      console.error('Error resolving anomaly:', error);
      setAlert({ type: 'error', message: 'Failed to resolve anomaly' });
    }
  };

  const handleAcknowledgeAnomaly = async (anomalyId) => {
    try {
      await lotteryAPI.acknowledgeAnomaly(anomalyId);
      setAlert({ type: 'success', message: 'Anomaly acknowledged' });
      loadPreview();
    } catch (error) {
      console.error('Error acknowledging anomaly:', error);
      setAlert({ type: 'error', message: 'Failed to acknowledge anomaly' });
    }
  };

  if (loading && !preview) {
    return <div className="text-center py-8">Loading day close preview...</div>;
  }

  const highSeverityAnomalies = preview?.anomalies?.filter(a => a.severity === 'high' && a.status === 'open') || [];
  const canPost = preview?.can_post && highSeverityAnomalies.length === 0;

  return (
    <div>
      {alert && (
        <div className={`mb-4 p-4 rounded ${
          alert.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
          'bg-green-50 text-green-800 border border-green-200'
        }`}>
          <div className="flex justify-between items-center">
            <span>{alert.message}</span>
            <button onClick={() => setAlert(null)} className="text-lg">×</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-6 flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <button
            onClick={loadPreview}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 mt-6"
          >
            Refresh Preview
          </button>
        </div>

        {preview && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Instant Commission</div>
                <div className="text-2xl font-bold text-blue-900">
                  ${preview.instant_commission?.toFixed(2) || '0.00'}
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Draw/Online Commission</div>
                <div className="text-2xl font-bold text-purple-900">
                  ${preview.draw_commission?.toFixed(2) || '0.00'}
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Total Commission</div>
                <div className="text-2xl font-bold text-green-900">
                  ${preview.total_commission?.toFixed(2) || '0.00'}
                </div>
              </div>
            </div>

            {/* Instant Lottery Breakdown */}
            {preview.instant_by_game && preview.instant_by_game.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Instant Lottery by Game</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Game</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tickets Sold</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {preview.instant_by_game.map((game, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-3 whitespace-nowrap">{game.game_code}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{game.tickets_sold}</td>
                          <td className="px-4 py-3 whitespace-nowrap">${game.ticket_price?.toFixed(2)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">${game.commission_amount?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Draw/Online Summary */}
            {preview.draw_totals && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Draw/Online Lottery</h3>
                <div className="bg-gray-50 p-4 rounded">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total Sales:</span>
                      <div className="font-semibold">${preview.draw_totals.total_sales?.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Cashed:</span>
                      <div className="font-semibold">${preview.draw_totals.total_cashed?.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Net Sale:</span>
                      <div className="font-semibold">${preview.draw_totals.net_sale?.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Commission:</span>
                      <div className="font-semibold">${preview.draw_totals.commission?.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Anomalies */}
            {preview.anomalies && preview.anomalies.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">
                  Anomalies ({preview.anomalies.length})
                </h3>
                <div className="space-y-2">
                  {preview.anomalies.map((anomaly) => (
                    <AnomalyCard
                      key={anomaly.id}
                      anomaly={anomaly}
                      onResolve={handleResolveAnomaly}
                      onAcknowledge={handleAcknowledgeAnomaly}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {preview.warnings && preview.warnings.length > 0 && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
                <h3 className="font-semibold text-yellow-900 mb-2">Warnings</h3>
                <ul className="list-disc list-inside space-y-1 text-yellow-800">
                  {preview.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Post GL Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handlePostGL}
                disabled={!canPost || posting}
                className={`px-6 py-3 rounded-md font-medium ${
                  canPost
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                }`}
              >
                {posting ? 'Posting...' : 'Post GL Entries'}
              </button>
            </div>

            {!canPost && highSeverityAnomalies.length > 0 && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
                <strong>Cannot post GL:</strong> {highSeverityAnomalies.length} high-severity anomaly(ies) must be resolved first.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const AnomalyCard = ({ anomaly, onResolve, onAcknowledge }) => {
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolveNote, setResolveNote] = useState('');

  const handleResolve = () => {
    if (!resolveNote.trim()) {
      alert('Please enter a resolution note');
      return;
    }
    onResolve(anomaly.id, resolveNote);
    setShowResolveForm(false);
    setResolveNote('');
  };

  if (anomaly.status === 'resolved') {
    return (
      <div className="p-3 bg-green-50 border border-green-200 rounded">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-1 rounded text-xs ${
                anomaly.severity === 'high' ? 'bg-red-200 text-red-900' :
                anomaly.severity === 'medium' ? 'bg-orange-200 text-orange-900' :
                'bg-yellow-200 text-yellow-900'
              }`}>
                {anomaly.severity.toUpperCase()} - {anomaly.type.toUpperCase()}
              </span>
              <span className="text-xs text-green-700">RESOLVED</span>
            </div>
            <div className="text-sm text-gray-700">{anomaly.detail}</div>
            {anomaly.resolved_note && (
              <div className="text-xs text-gray-600 mt-1">Note: {anomaly.resolved_note}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-3 border rounded ${
      anomaly.severity === 'high' ? 'bg-red-50 border-red-200' :
      anomaly.severity === 'medium' ? 'bg-orange-50 border-orange-200' :
      'bg-yellow-50 border-yellow-200'
    }`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-1 rounded text-xs ${
              anomaly.severity === 'high' ? 'bg-red-200 text-red-900' :
              anomaly.severity === 'medium' ? 'bg-orange-200 text-orange-900' :
              'bg-yellow-200 text-yellow-900'
            }`}>
              {anomaly.severity.toUpperCase()} - {anomaly.type.toUpperCase()}
            </span>
          </div>
          <div className="text-sm text-gray-700 mb-2">{anomaly.detail}</div>
          {anomaly.box_label && (
            <div className="text-xs text-gray-600">Box: {anomaly.box_label}</div>
          )}
        </div>
        <div className="flex gap-2">
          {anomaly.severity === 'high' && (
            <button
              onClick={() => setShowResolveForm(!showResolveForm)}
              className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
            >
              Resolve
            </button>
          )}
          {(anomaly.severity === 'medium' || anomaly.severity === 'low') && (
            <button
              onClick={() => onAcknowledge(anomaly.id)}
              className="px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
            >
              Acknowledge
            </button>
          )}
        </div>
      </div>

      {showResolveForm && (
        <div className="mt-3 pt-3 border-t border-red-300">
          <textarea
            value={resolveNote}
            onChange={(e) => setResolveNote(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-2"
            rows="2"
            placeholder="Enter resolution note..."
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowResolveForm(false);
                setResolveNote('');
              }}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleResolve}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
            >
              Confirm Resolution
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DayClose;

