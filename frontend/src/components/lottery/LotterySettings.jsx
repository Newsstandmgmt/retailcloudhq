import { useState, useEffect } from 'react';
import { lotteryAPI } from '../../services/api';
import LotteryEmailSettings from './LotteryEmailSettings';

const LotterySettings = ({ storeId }) => {
  const [games, setGames] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('games');
  const [showGameModal, setShowGameModal] = useState(false);
  const [showBoxModal, setShowBoxModal] = useState(false);
  const [gameForm, setGameForm] = useState({
    game_id: '',
    name: '',
    ticket_price: '',
    tickets_per_pack: '',
    commission_rate: '',
    is_active: true
  });
  const [boxForm, setBoxForm] = useState({
    box_label: '',
    description: '',
    qr_code: ''
  });

  useEffect(() => {
    loadData();
  }, [storeId, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'games') {
        const response = await lotteryAPI.getGames();
        setGames(response.data.games || []);
      } else if (activeTab === 'boxes') {
        const response = await lotteryAPI.getBoxes(storeId);
        setBoxes(response.data.boxes || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGame = async (e) => {
    e.preventDefault();
    try {
      await lotteryAPI.createGame({
        ...gameForm,
        ticket_price: parseFloat(gameForm.ticket_price),
        tickets_per_pack: parseInt(gameForm.tickets_per_pack),
        commission_rate: parseFloat(gameForm.commission_rate) / 100 // Convert percentage to decimal
      });
      setShowGameModal(false);
      setGameForm({
        game_id: '',
        name: '',
        ticket_price: '',
        tickets_per_pack: '',
        commission_rate: '',
        is_active: true
      });
      loadData();
    } catch (error) {
      console.error('Error creating game:', error);
      alert('Failed to create game');
    }
  };

  const handleCreateBox = async (e) => {
    e.preventDefault();
    try {
      await lotteryAPI.createBox(storeId, boxForm);
      setShowBoxModal(false);
      setBoxForm({ box_label: '', description: '', qr_code: '' });
      loadData();
    } catch (error) {
      console.error('Error creating box:', error);
      alert('Failed to create box');
    }
  };

  const tabs = [
    { id: 'games', name: 'Games' },
    { id: 'boxes', name: 'Boxes' },
    { id: 'email', name: 'Email Auto-Import' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Lottery Settings</h2>
        
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-4">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  ${activeTab === tab.id
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                  whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm
                `}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Games Tab */}
      {activeTab === 'games' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Instant Lottery Games</h3>
            <button
              onClick={() => setShowGameModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              + Add Game
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading games...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Game ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tickets/Pack</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission Rate</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {games.map((game) => (
                    <tr key={game.id}>
                      <td className="px-4 py-3 whitespace-nowrap">{game.game_id}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{game.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">${game.ticket_price?.toFixed(2)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{game.tickets_per_pack}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{(game.commission_rate * 100).toFixed(2)}%</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs ${
                          game.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {game.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Boxes Tab */}
      {activeTab === 'boxes' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Store Boxes</h3>
            <button
              onClick={() => setShowBoxModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              + Add Box
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading boxes...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {boxes.map((box) => (
                <div
                  key={box.id}
                  className="p-4 border-2 border-gray-300 rounded-lg text-center"
                >
                  <div className="text-2xl font-bold text-gray-800 mb-2">{box.box_label}</div>
                  {box.description && (
                    <div className="text-sm text-gray-600">{box.description}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Game Modal */}
      {showGameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Create Game</h3>
            <form onSubmit={handleCreateGame}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Game ID</label>
                  <input
                    type="text"
                    value={gameForm.game_id}
                    onChange={(e) => setGameForm({ ...gameForm, game_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={gameForm.name}
                    onChange={(e) => setGameForm({ ...gameForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={gameForm.ticket_price}
                    onChange={(e) => setGameForm({ ...gameForm, ticket_price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tickets per Pack</label>
                  <input
                    type="number"
                    value={gameForm.tickets_per_pack}
                    onChange={(e) => setGameForm({ ...gameForm, tickets_per_pack: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Commission Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={gameForm.commission_rate}
                    onChange={(e) => setGameForm({ ...gameForm, commission_rate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., 6.00"
                    required
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowGameModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Create Game
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Box Modal */}
      {showBoxModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Create Box</h3>
            <form onSubmit={handleCreateBox}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Box Label</label>
                  <input
                    type="text"
                    value={boxForm.box_label}
                    onChange={(e) => setBoxForm({ ...boxForm, box_label: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., A1, B3, D4"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                  <input
                    type="text"
                    value={boxForm.description}
                    onChange={(e) => setBoxForm({ ...boxForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">QR Code (Optional)</label>
                  <input
                    type="text"
                    value={boxForm.qr_code}
                    onChange={(e) => setBoxForm({ ...boxForm, qr_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowBoxModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Create Box
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email Settings Tab */}
      {activeTab === 'email' && (
        <LotteryEmailSettings storeId={storeId} />
      )}
    </div>
  );
};

export default LotterySettings;

