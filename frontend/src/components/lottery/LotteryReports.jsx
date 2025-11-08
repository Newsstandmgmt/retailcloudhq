import { useState } from 'react';
import { lotteryAPI, lotteryAnalyticsAPI } from '../../services/api';
import SalesPaidoutReport from './reports/SalesPaidoutReport';
import DailyReport from './reports/DailyReport';

const LotteryReports = ({ storeId }) => {
  const [activeReport, setActiveReport] = useState('sales-paidout');

  const reports = [
    { id: 'sales-paidout', name: 'Sales / PaidOut Report' },
    { id: 'daily', name: 'Lottery Daily Report' },
    { id: 'summary', name: 'Daily Summary' },
    { id: 'anomalies', name: 'Anomalies Log' },
    { id: 'settlement', name: 'Settlement Reconciliation' },
    { id: 'packlifecycle', name: 'Pack Lifecycle' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Lottery Reports</h2>
        
        {/* Report Tabs */}
        <div className="border-b border-gray-200 mb-4">
          <nav className="-mb-px flex space-x-8">
            {reports.map((report) => (
              <button
                key={report.id}
                onClick={() => setActiveReport(report.id)}
                className={`
                  ${activeReport === report.id
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                  whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm
                `}
              >
                {report.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Date Range Filter */}
        <div className="flex gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.start_date}
              onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.end_date}
              onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {activeReport === 'sales-paidout' && <SalesPaidoutReport storeId={storeId} />}
        {activeReport === 'daily' && <DailyReport storeId={storeId} />}
        
        {activeReport === 'summary' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Daily Lottery Summary</h3>
            <p className="text-gray-600">Report coming soon...</p>
          </div>
        )}

        {activeReport === 'anomalies' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Anomalies Log</h3>
            <p className="text-gray-600">Report coming soon...</p>
          </div>
        )}

        {activeReport === 'settlement' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Settlement Reconciliation</h3>
            <p className="text-gray-600">Report coming soon...</p>
          </div>
        )}

        {activeReport === 'packlifecycle' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Pack Lifecycle</h3>
            <p className="text-gray-600">Report coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LotteryReports;

