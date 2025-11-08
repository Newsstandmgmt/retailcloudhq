import { useState, useEffect } from 'react';
import { lotteryAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const BoxesView = ({ storeId }) => {
  const { user } = useAuth();
  const [boxes, setBoxes] = useState([]);
  const [packs, setPacks] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBox, setSelectedBox] = useState(null);
  const [readingForm, setReadingForm] = useState({
    pack_id: '',
    game_id: '',
    box_label: '',
    ticket_number: '',
    note: '',
    source: 'manual'
  });
  const [showReadingModal, setShowReadingModal] = useState(false);
  const [anomalies, setAnomalies] = useState([]);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadData();
  }, [storeId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [boxesRes, packsRes, gamesRes] = await Promise.all([
        lotteryAPI.getBoxes(storeId),
        lotteryAPI.getPacks(storeId, { status: 'active' }),
        lotteryAPI.getGames()
      ]);
      setBoxes(boxesRes.data.boxes || []);
      setPacks(packsRes.data.packs || []);
      setGames(gamesRes.data.games || []);
    } catch (error) {
      console.error('Error loading data:', error);
      setAlert({ type: 'error', message: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  };

  const handleBoxClick = (box) => {
    setSelectedBox(box);
    const boxPack = packs.find(p => p.box_label === box.box_label);
    if (boxPack) {
      setReadingForm({
        pack_id: boxPack.pack_id,
        game_id: boxPack.game_id,
        box_label: box.box_label,
        ticket_number: boxPack.current_ticket || boxPack.start_ticket || '',
        note: '',
        source: 'manual'
      });
    } else {
      setReadingForm({
        pack_id: '',
        game_id: '',
        box_label: box.box_label,
        ticket_number: '',
        note: '',
        source: 'manual'
      });
    }
    setShowReadingModal(true);
  };

  const handleSubmitReading = async (e) => {
    e.preventDefault();
    if (!readingForm.pack_id || !readingForm.ticket_number) {
      setAlert({ type: 'error', message: 'Pack ID and ticket number are required' });
      return;
    }

    try {
      const result = await lotteryAPI.recordReading(storeId, {
        ...readingForm,
        ticket_number: parseInt(readingForm.ticket_number)
      });

      if (result.data.anomalies && result.data.anomalies.length > 0) {
        setAnomalies(result.data.anomalies);
        setAlert({ 
          type: 'warning', 
          message: `Reading recorded with ${result.data.anomalies.length} anomaly(ies) detected` 
        });
      } else {
        setAlert({ type: 'success', message: 'Reading recorded successfully' });
        setShowReadingModal(false);
        setAnomalies([]);
        loadData();
      }
    } catch (error) {
      console.error('Error recording reading:', error);
      setAlert({ type: 'error', message: error.response?.data?.error || 'Failed to record reading' });
    }
  };

  const getPackForBox = (boxLabel) => {
    return packs.find(p => p.box_label === boxLabel && p.status === 'active');
  };

  const getLastReading = (pack) => {
    // This would be enhanced to fetch actual last reading time
    return pack.activated_at ? new Date(pack.activated_at).toLocaleString() : 'Never';
  };

  if (loading) {
    return <div className="text-center py-8">Loading boxes...</div>;
  }

  return (
    <div>
      {alert && (
        <div className={`mb-4 p-4 rounded ${
          alert.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
          alert.type === 'warning' ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' :
          'bg-green-50 text-green-800 border border-green-200'
        }`}>
          <div className="flex justify-between items-center">
            <span>{alert.message}</span>
            <button onClick={() => setAlert(null)} className="text-lg">×</button>
          </div>
        </div>
      )}

      {anomalies.length > 0 && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <h3 className="font-semibold text-yellow-900 mb-2">Anomalies Detected:</h3>
          <ul className="list-disc list-inside space-y-1">
            {anomalies.map((anomaly, idx) => (
              <li key={idx} className="text-yellow-800">
                <span className={`inline-block px-2 py-1 rounded text-xs mr-2 ${
                  anomaly.severity === 'high' ? 'bg-red-200 text-red-900' :
                  anomaly.severity === 'medium' ? 'bg-orange-200 text-orange-900' :
                  'bg-yellow-200 text-yellow-900'
                }`}>
                  {anomaly.severity.toUpperCase()}
                </span>
                {anomaly.detail} ({anomaly.type})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold">Instant Lottery Boxes</h2>
        <button
          onClick={() => setShowReadingModal(true)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          + Quick Entry
        </button>
      </div>

      {/* Boxes Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {boxes.map((box) => {
          const pack = getPackForBox(box.box_label);
          const hasPack = !!pack;
          const isActive = hasPack && pack.status === 'active';

          return (
            <div
              key={box.id}
              onClick={() => handleBoxClick(box)}
              className={`
                p-4 border-2 rounded-lg cursor-pointer transition-all
                ${isActive 
                  ? 'border-green-500 bg-green-50 hover:bg-green-100' 
                  : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                }
              `}
            >
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-800 mb-2">{box.box_label}</div>
                {hasPack ? (
                  <>
                    <div className="text-sm text-gray-600 mb-1">
                      <span className="font-semibold">{pack.game_code || pack.game_name}</span>
                    </div>
                    <div className="text-xs text-gray-500 mb-1">
                      Ticket: {pack.current_ticket || pack.start_ticket}
                    </div>
                    <div className="text-xs text-gray-400">
                      {getLastReading(pack)}
                    </div>
                    {pack.status === 'sold_out' && (
                      <div className="mt-2 text-xs bg-red-200 text-red-800 px-2 py-1 rounded">
                        SOLD OUT
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-gray-400">Empty</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reading Modal */}
      {showReadingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Record Reading</h3>
            <form onSubmit={handleSubmitReading}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Box Label
                  </label>
                  <input
                    type="text"
                    value={readingForm.box_label}
                    onChange={(e) => setReadingForm({ ...readingForm, box_label: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pack ID (scan or enter)
                  </label>
                  <input
                    type="text"
                    value={readingForm.pack_id}
                    onChange={(e) => setReadingForm({ ...readingForm, pack_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Scan barcode or enter pack ID"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Game
                  </label>
                  <select
                    value={readingForm.game_id}
                    onChange={(e) => setReadingForm({ ...readingForm, game_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="">Select Game</option>
                    {games.map(game => (
                      <option key={game.id} value={game.id}>
                        {game.game_id} - {game.name} (${game.ticket_price})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ticket Number
                  </label>
                  <input
                    type="number"
                    value={readingForm.ticket_number}
                    onChange={(e) => setReadingForm({ ...readingForm, ticket_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Enter current ticket number"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source
                  </label>
                  <select
                    value={readingForm.source}
                    onChange={(e) => setReadingForm({ ...readingForm, source: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="manual">Manual Entry</option>
                    <option value="scan">Scan</option>
                    <option value="ocr">OCR/Camera</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note (Optional)
                  </label>
                  <textarea
                    value={readingForm.note}
                    onChange={(e) => setReadingForm({ ...readingForm, note: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows="2"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowReadingModal(false);
                    setAnomalies([]);
                    setAlert(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Record Reading
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoxesView;

