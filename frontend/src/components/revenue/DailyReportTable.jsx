/**
 * Daily Report Table Component
 * 
 * Displays a table of daily revenue entries with all entered data.
 * Shows data as it's entered and allows viewing multiple dates.
 */
import { useState, useEffect } from 'react';
import { revenueAPI, customerTabsAPI } from '../../services/api';

const DailyReportTable = ({ storeId, selectedDate, onDateSelect, initialDateRange, onCashOnHandLoaded }) => {
  const [revenueData, setRevenueData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(
    initialDateRange || {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 7 days
      end: new Date().toISOString().split('T')[0]
    }
  );
  const [customerTabData, setCustomerTabData] = useState({});
  const [cashOnHandData, setCashOnHandData] = useState({});

  useEffect(() => {
    // Update dateRange when initialDateRange changes from parent
    if (initialDateRange && initialDateRange.start && initialDateRange.end) {
      setDateRange(initialDateRange);
    }
  }, [initialDateRange]);

  useEffect(() => {
    if (storeId) {
      loadRevenueData();
    }
  }, [storeId, dateRange]);

  useEffect(() => {
    // Load customer tab data and cash on hand for all dates
    if (storeId && revenueData.length > 0) {
      loadCustomerTabData();
      loadCashOnHandData();
    }
  }, [storeId, revenueData]);

  const loadRevenueData = async () => {
    if (!storeId || !dateRange.start || !dateRange.end) {
      setRevenueData([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      // Ensure dates are in YYYY-MM-DD format
      const startDate = dateRange.start.split('T')[0]; // Remove time if present
      const endDate = dateRange.end.split('T')[0]; // Remove time if present
      
      console.log('Loading revenue data for range:', { startDate, endDate, storeId });
      
      const response = await revenueAPI.getDailyRevenueRange(
        storeId,
        startDate,
        endDate
      );
      const revenues = response.data.revenues || [];
      
      console.log('Received revenues:', revenues.length, 'entries');
      
      // Generate all dates in the range
      const allDates = [];
      
      // Normalize date strings to YYYY-MM-DD format (remove time component if present)
      const startDateStr = dateRange.start.split('T')[0];
      const endDateStr = dateRange.end.split('T')[0];
      
      // Create a map of existing revenue data by date
      // Normalize entry_date to YYYY-MM-DD format (remove time component if present)
      const revenueMap = {};
      revenues.forEach(revenue => {
        // Normalize entry_date to YYYY-MM-DD format
        const normalizedDate = revenue.entry_date ? revenue.entry_date.split('T')[0] : null;
        if (normalizedDate) {
          revenueMap[normalizedDate] = {
            ...revenue,
            entry_date: normalizedDate // Ensure entry_date is normalized
          };
        }
      });
      
      console.log('Revenue map keys:', Object.keys(revenueMap));
      
      // Parse start and end dates as local dates
      const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
      const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);
      
      const currentDate = new Date(startYear, startMonth - 1, startDay);
      const endDateLocal = new Date(endYear, endMonth - 1, endDay);
      
      // Generate dates until we've included the end date (inclusive)
      // Compare dates properly to ensure end date is included
      const endDateStrParsed = endDateStr; // Already in YYYY-MM-DD format
      
      while (true) {
        // Format date as YYYY-MM-DD (local date, not ISO)
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        // If we have data for this date, use it; otherwise create empty entry
        if (revenueMap[dateStr]) {
          allDates.push(revenueMap[dateStr]);
        } else {
          // Create empty revenue entry for this date
          allDates.push({
            entry_date: dateStr,
            store_id: storeId,
            total_cash: 0,
            business_credit_card: 0,
            credit_card_transaction_fees: 0,
            online_sales: 0,
            online_net: 0,
            total_instant: 0,
            total_instant_adjustment: 0,
            instant_pay: 0,
            lottery_credit_card: 0,
            sales_tax_amount: 0,
            newspaper_sold: 0,
            elias_newspaper: 0,
            sam_newspaper: 0,
            customer_tab: 0,
            other_cash_expense: 0,
            weekly_lottery_commission: null,
            thirteen_week_average: null,
            weekly_lottery_due: null,
            store_closed: false,
            notes: null
          });
        }
        
        // Check if we've reached or passed the end date (compare date strings)
        // String comparison works for YYYY-MM-DD format
        if (dateStr >= endDateStrParsed) {
          break;
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      setRevenueData(allDates);
    } catch (error) {
      console.error('Error loading revenue data:', error);
      setRevenueData([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerTabData = async () => {
    if (!storeId || revenueData.length === 0) return;
    try {
      const tabDataMap = {};
      for (const revenue of revenueData) {
        const date = revenue.entry_date;
        // Initialize with zeros for all dates
        tabDataMap[date] = { credits: 0, debits: 0, netTab: 0 };
        
        // Only fetch if we have actual revenue data (not just empty placeholder)
        if (revenue.id || revenue.total_cash > 0 || revenue.business_credit_card > 0) {
          try {
            const response = await customerTabsAPI.getDailyTotals(storeId, date);
            const totals = response.data.totals || {};
            tabDataMap[date] = {
              credits: parseFloat(totals.total_charges || 0),
              debits: parseFloat(totals.total_payments || 0),
              netTab: parseFloat(totals.net_tab_amount || 0)
            };
          } catch (error) {
            // Keep zeros if API call fails
            tabDataMap[date] = { credits: 0, debits: 0, netTab: 0 };
          }
        }
      }
      setCustomerTabData(tabDataMap);
    } catch (error) {
      console.error('Error loading customer tab data:', error);
    }
  };

  const loadCashOnHandData = async () => {
    if (!storeId || revenueData.length === 0) return;
    try {
      const cashOnHandMap = {};
      for (const revenue of revenueData) {
        const date = revenue.entry_date;
        // Initialize with zeros for all dates
        cashOnHandMap[date] = { businessCashOnHand: 0, lotteryCashOnHand: 0 };
        
        // Only fetch if we have actual revenue data (not just empty placeholder)
        if (revenue.id || revenue.total_cash > 0 || revenue.business_credit_card > 0) {
          try {
            // Get cash on hand for this date
            const response = await revenueAPI.getDailyRevenue(storeId, date);
            if (response.data.cashOnHand) {
              cashOnHandMap[date] = {
                businessCashOnHand: parseFloat(response.data.cashOnHand.businessCashOnHand || 0),
                lotteryCashOnHand: parseFloat(response.data.cashOnHand.lotteryCashOnHand || 0)
              };
            }
          } catch (error) {
            // Keep zeros if API call fails
            cashOnHandMap[date] = { businessCashOnHand: 0, lotteryCashOnHand: 0 };
          }
        }
      }
      setCashOnHandData(cashOnHandMap);
      
      // Notify parent component of latest cash on hand values (from actual data, not empty placeholders)
      if (onCashOnHandLoaded && revenueData.length > 0) {
        // Find the latest date with actual data
        const latestRevenue = revenueData
          .filter(r => r.id || r.total_cash > 0 || r.business_credit_card > 0)
          .sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date))[0];
        
        if (latestRevenue) {
          const latestCashOnHand = cashOnHandMap[latestRevenue.entry_date] || { businessCashOnHand: 0, lotteryCashOnHand: 0 };
          onCashOnHandLoaded(latestCashOnHand);
        }
      }
    } catch (error) {
      console.error('Error loading cash on hand data:', error);
    }
  };

  const formatCurrency = (value) => {
    if (!value && value !== 0) return '0.00';
    return parseFloat(value).toFixed(2);
  };

  // Get week number from a date (simple calculation - week 1 starts Jan 1)
  const getWeekNumber = (date) => {
    try {
      if (!date || isNaN(date.getTime())) {
        return 1;
      }
      
      // Create a copy to avoid mutating
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      
      // Get the first day of the year
      const yearStart = new Date(d.getFullYear(), 0, 1);
      yearStart.setHours(0, 0, 0, 0);
      
      // Calculate the number of days from year start
      const daysDiff = Math.floor((d - yearStart) / (1000 * 60 * 60 * 24));
      
      // Calculate week number (week 1 = first 7 days)
      const weekNumber = Math.ceil((daysDiff + yearStart.getDay() + 1) / 7);
      
      return weekNumber > 0 ? weekNumber : 1;
    } catch (error) {
      console.error('Error calculating week number:', error, date);
      return 1;
    }
  };

  // Format date header with day of week and week number
  const formatDateHeader = (dateString) => {
    try {
      let date;
      
      // Handle different date formats
      if (dateString instanceof Date) {
        date = new Date(dateString);
      } else if (typeof dateString === 'string') {
        // Try parsing as YYYY-MM-DD format first
        if (dateString.includes('-')) {
          const [year, month, day] = dateString.split('-').map(Number);
          if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            date = new Date(year, month - 1, day);
          } else {
            date = new Date(dateString);
          }
        } else {
          date = new Date(dateString);
        }
      } else {
        console.error('Invalid date format:', dateString);
        return 'Invalid Date';
      }
      
      // Validate the date
      if (isNaN(date.getTime())) {
        console.error('Invalid date created from:', dateString);
        return 'Invalid Date';
      }
      
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
      const weekNumber = getWeekNumber(date);
      
      if (!dayOfWeek || isNaN(weekNumber)) {
        console.error('Error formatting date header for:', dateString, 'date:', date);
        return dateString; // Return original if formatting fails
      }
      
      return `${dayOfWeek}, Week ${weekNumber}`;
    } catch (error) {
      console.error('Error in formatDateHeader:', error, dateString);
      return dateString || 'Invalid Date'; // Return original string on error
    }
  };

  const calculateDailyBusinessAmount = (revenue, tabTotals = { credits: 0, debits: 0 }) => {
    const apiDailyBusiness = revenue?.daily_business_total ?? revenue?.daily_business_amount;
    if (apiDailyBusiness !== undefined && apiDailyBusiness !== null) {
      const parsedApiValue = parseFloat(apiDailyBusiness);
      if (!isNaN(parsedApiValue)) {
        return parsedApiValue;
      }
    }

    const calculatedBusinessCashRaw = revenue?.calculated_business_cash;
    if (calculatedBusinessCashRaw !== undefined && calculatedBusinessCashRaw !== null) {
      const parsedCalculated = parseFloat(calculatedBusinessCashRaw);
      if (!isNaN(parsedCalculated)) {
        return parsedCalculated;
      }
    }

    const totalCash = parseFloat(revenue.total_cash || 0);
    const businessCreditCard = parseFloat(revenue.business_credit_card || 0);
    const creditCardFees = parseFloat(revenue.credit_card_transaction_fees || 0);
    const otherIncomeRaw = parseFloat(revenue.other_cash_expense || 0);
    const otherIncome = otherIncomeRaw > 0 ? otherIncomeRaw : 0;
    const onlineNet = parseFloat(revenue.online_net || 0);
    const totalInstant = parseFloat(revenue.total_instant || 0);
    const instantAdjustment = parseFloat(revenue.total_instant_adjustment || 0);
    const instantPay = parseFloat(revenue.instant_pay || 0);
    const lotteryCreditCard = parseFloat(revenue.lottery_credit_card || 0);
    const vendorPaymentsTotal = parseFloat(revenue.vendor_payments_total || 0);

    const customerCredits = parseFloat(tabTotals.credits || 0);
    const customerDebits = parseFloat(tabTotals.debits || 0);
    const customerTabNet = customerCredits - customerDebits;
    const customerTabAdjustment = customerTabNet > 0 ? -customerTabNet : Math.abs(customerTabNet);

    const instantAdjustmentAdjustment = instantAdjustment > 0 ? -instantAdjustment : Math.abs(instantAdjustment);

    const dailyBusiness =
      totalCash +
      businessCreditCard -
      otherIncome +
      vendorPaymentsTotal +
      customerTabAdjustment -
      onlineNet -
      totalInstant +
      instantAdjustmentAdjustment +
      instantPay +
      lotteryCreditCard;

    return dailyBusiness;
  };

  // Calculate totals
  const totals = revenueData.reduce((acc, revenue) => {
    const date = revenue.entry_date;
    const tabData = customerTabData[date] || { credits: 0, debits: 0, netTab: 0 };
    const cashOnHand = cashOnHandData[date] || { businessCashOnHand: 0, lotteryCashOnHand: 0 };
    
    return {
      totalCash: acc.totalCash + parseFloat(revenue.total_cash || 0),
      salesTax: acc.salesTax + parseFloat(revenue.sales_tax_amount || 0),
      creditCard: acc.creditCard + parseFloat(revenue.business_credit_card || 0),
      creditCardFees: acc.creditCardFees + parseFloat(revenue.credit_card_transaction_fees || 0),
      customerCredits: acc.customerCredits + tabData.credits,
      customerDebits: acc.customerDebits + tabData.debits,
      onlineSales: acc.onlineSales + parseFloat(revenue.online_sales || 0),
      onlineNet: acc.onlineNet + parseFloat(revenue.online_net || 0),
      totalInstant: acc.totalInstant + parseFloat(revenue.total_instant || 0),
      instantAdjustment: acc.instantAdjustment + parseFloat(revenue.total_instant_adjustment || 0),
      instantPay: acc.instantPay + parseFloat(revenue.instant_pay || 0),
      lotteryCreditCard: acc.lotteryCreditCard + parseFloat(revenue.lottery_credit_card || 0),
      weeklyLotteryCommission: acc.weeklyLotteryCommission + parseFloat(revenue.weekly_lottery_commission || 0),
      thirteenWeekAverage: acc.thirteenWeekAverage + parseFloat(revenue.thirteen_week_average || 0),
      weeklyLotteryDue: acc.weeklyLotteryDue + parseFloat(revenue.weekly_lottery_due || 0),
      dailyBusiness: acc.dailyBusiness + calculateDailyBusinessAmount(revenue, tabData),
      businessCashOnHand: acc.businessCashOnHand + cashOnHand.businessCashOnHand,
      lotteryCashOnHand: acc.lotteryCashOnHand + cashOnHand.lotteryCashOnHand
    };
  }, {
    totalCash: 0,
    salesTax: 0,
    creditCard: 0,
    creditCardFees: 0,
    customerCredits: 0,
    customerDebits: 0,
    onlineSales: 0,
    onlineNet: 0,
    totalInstant: 0,
    instantAdjustment: 0,
    instantPay: 0,
    lotteryCreditCard: 0,
    weeklyLotteryCommission: 0,
    thirteenWeekAverage: 0,
    weeklyLotteryDue: 0,
    dailyBusiness: 0,
    businessCashOnHand: 0,
    lotteryCashOnHand: 0
  });

  const handleExportExcel = () => {
    // Create CSV content
    const headers = [
      'Date',
      'Total Cash',
      'Sales Tax',
      'Credit Card',
      'Credit Card Fees',
      'Customer Credits',
      'Customer Debits',
      'Online Sales',
      'Online Net',
      'Total Instant',
      'Instant Adjustment',
      'Instant Pay',
      'Lottery Card Trans',
      'Weekly Lottery Commission',
      '13 Week Average',
      'Weekly Lottery Due',
      'Daily Business Amount',
      'Business Cash On Hand',
      'Lottery Cash On Hand'
    ];

    const rows = revenueData.map(revenue => {
      const date = revenue.entry_date;
      const tabData = customerTabData[date] || { credits: 0, debits: 0, netTab: 0 };
      const cashOnHand = cashOnHandData[date] || { businessCashOnHand: 0, lotteryCashOnHand: 0 };
      
      return [
        revenue.entry_date,
        formatCurrency(revenue.total_cash),
        formatCurrency(revenue.sales_tax_amount),
        formatCurrency(revenue.business_credit_card),
        formatCurrency(revenue.credit_card_transaction_fees),
        formatCurrency(tabData.credits),
        formatCurrency(tabData.debits),
        formatCurrency(revenue.online_sales),
        formatCurrency(revenue.online_net),
        formatCurrency(revenue.total_instant),
        formatCurrency(revenue.total_instant_adjustment),
        formatCurrency(revenue.instant_pay),
        formatCurrency(revenue.lottery_credit_card),
        formatCurrency(revenue.weekly_lottery_commission),
        formatCurrency(revenue.thirteen_week_average),
        formatCurrency(revenue.weekly_lottery_due),
        formatCurrency(calculateDailyBusinessAmount(revenue, tabData)),
        formatCurrency(cashOnHand.businessCashOnHand),
        formatCurrency(cashOnHand.lotteryCashOnHand)
      ];
    });

    // Add totals row
    rows.push([
      'Total',
      formatCurrency(totals.totalCash),
      formatCurrency(totals.salesTax),
      formatCurrency(totals.creditCard),
      formatCurrency(totals.creditCardFees),
      formatCurrency(totals.customerCredits),
      formatCurrency(totals.customerDebits),
      formatCurrency(totals.onlineSales),
      formatCurrency(totals.onlineNet),
      formatCurrency(totals.totalInstant),
      formatCurrency(totals.instantAdjustment),
      formatCurrency(totals.instantPay),
      formatCurrency(totals.lotteryCreditCard),
      formatCurrency(totals.weeklyLotteryCommission),
      formatCurrency(totals.thirteenWeekAverage),
      formatCurrency(totals.weeklyLotteryDue),
        formatCurrency(totals.dailyBusiness),
      formatCurrency(totals.businessCashOnHand),
      formatCurrency(totals.lotteryCashOnHand)
    ]);

    // Convert to CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `daily-report-${dateRange.start}-to-${dateRange.end}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    // Import jsPDF dynamically
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then((autoTable) => {
        const doc = new jsPDF('landscape', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        
        // Header
        doc.setFillColor(37, 134, 89); // #2d8659
        doc.rect(0, 0, pageWidth, 60, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('Daily Revenue Report', pageWidth / 2, 30, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Period: ${new Date(dateRange.start).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} to ${new Date(dateRange.end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, pageWidth / 2, 50, { align: 'center' });
        
        // Reset text color
        doc.setTextColor(0, 0, 0);
        
        // Prepare table data
        const sortedRevenues = [...revenueData].sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date));
        
        // Table headers
        const headers = [
          ['Date', 'Total Cash', 'Credit Card', 'CC Fees', 'Online Sales', 'Online Net', 
           'Total Instant', 'Instant Pay', 'Lottery Card Trans', 'Daily Business Amount']
        ];
        
        // Table rows
        const rows = sortedRevenues.map(revenue => {
          const date = revenue.entry_date;
          const tabData = customerTabData[date] || { credits: 0, debits: 0, netTab: 0 };
          
          return [
            new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            `$${parseFloat(revenue.total_cash || 0).toFixed(2)}`,
            `$${parseFloat(revenue.business_credit_card || 0).toFixed(2)}`,
            `$${parseFloat(revenue.credit_card_transaction_fees || 0).toFixed(2)}`,
            `$${parseFloat(revenue.online_sales || 0).toFixed(2)}`,
            `$${parseFloat(revenue.online_net || 0).toFixed(2)}`,
            `$${parseFloat(revenue.total_instant || 0).toFixed(2)}`,
            `$${parseFloat(revenue.instant_pay || 0).toFixed(2)}`,
            `$${parseFloat(revenue.lottery_credit_card || 0).toFixed(2)}`,
            `$${calculateDailyBusinessAmount(revenue, tabData).toFixed(2)}`
          ];
        });
        
        // Add totals row
        rows.push([
          'TOTAL',
          `$${totals.totalCash.toFixed(2)}`,
          `$${totals.creditCard.toFixed(2)}`,
          `$${totals.creditCardFees.toFixed(2)}`,
          `$${totals.onlineSales.toFixed(2)}`,
          `$${totals.onlineNet.toFixed(2)}`,
          `$${totals.totalInstant.toFixed(2)}`,
          `$${totals.instantPay.toFixed(2)}`,
          `$${totals.lotteryCreditCard.toFixed(2)}`,
          `$${totals.dailyBusiness.toFixed(2)}`
        ]);
        
        // Generate table
        autoTable.default(doc, {
          head: headers,
          body: rows,
          startY: 70,
          theme: 'striped',
          headStyles: {
            fillColor: [45, 134, 89], // #2d8659
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 10
          },
          bodyStyles: {
            fontSize: 9
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245]
          },
          styles: {
            cellPadding: 5,
            overflow: 'linebreak'
          },
          columnStyles: {
            0: { cellWidth: 80 },
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' },
            6: { halign: 'right' },
            7: { halign: 'right' },
            8: { halign: 'right' },
            9: { halign: 'right', fontStyle: 'bold' }
          },
          didParseCell: (data) => {
            // Make totals row bold
            if (data.row.index === rows.length - 1) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [240, 240, 240];
            }
          }
        });
        
        // Footer
        const finalY = doc.lastAutoTable.finalY || pageHeight - 40;
        doc.setFontSize(10);
        doc.setTextColor(128, 128, 128);
        doc.text(`Generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, pageWidth / 2, finalY + 20, { align: 'center' });
        
        // Save PDF
        const fileName = `daily-report-${dateRange.start}-to-${dateRange.end}.pdf`;
        doc.save(fileName);
      });
    });
  };

  if (loading) {
    return <div className="text-center py-4">Loading daily report...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900">Daily Report</h2>
        <div className="flex gap-2">
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <span className="self-center">to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
          >
            Export to Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Export to PDF
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table id="daily-report-table" className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 min-w-[180px]">
                Field
              </th>
              {revenueData.length === 0 ? (
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  No Data
                </th>
              ) : (
                <>
                  {revenueData
                    .sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date))
                    .map((revenue) => {
                      const date = revenue.entry_date;
                      // Only highlight if selectedDate is explicitly set and matches exactly
                      const isSelected = selectedDate && selectedDate === date;
                      return (
                        <th
                          key={date}
                          className={`px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors min-w-[140px] ${
                            isSelected ? 'bg-blue-50 ring-2 ring-blue-400' : ''
                          }`}
                          onClick={() => onDateSelect && onDateSelect(date)}
                          title={`Click to open ${new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} entry form`}
                        >
                          {formatDateHeader(date)}
                        </th>
                      );
                    })}
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider bg-gray-100 font-bold sticky right-0 z-10 min-w-[120px]">
                    Total
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {revenueData.length === 0 ? (
              <tr>
                <td colSpan="2" className="px-4 py-4 text-center text-gray-500">
                  No data available for the selected date range
                </td>
              </tr>
            ) : (
              <>
                {/* Store Closed Status Row */}
                <tr className="bg-red-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-red-50 z-10 min-w-[180px]">
                    Store Status
                  </td>
                  {revenueData
                    .sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date))
                    .map((revenue) => {
                      const date = revenue.entry_date;
                      const isClosed = revenue.store_closed === true;
                      const isSelected = selectedDate && selectedDate === date;
                      return (
                        <td
                          key={date}
                          className={`px-4 py-3 whitespace-nowrap text-sm text-center min-w-[140px] ${
                            isSelected ? 'bg-blue-50 ring-2 ring-blue-400' : ''
                          }`}
                        >
                          {isClosed ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Store Closed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Open
                            </span>
                          )}
                        </td>
                      );
                    })}
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500 bg-gray-100 font-semibold sticky right-0 z-10">
                    -
                  </td>
                </tr>
                {/* Date Row */}
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-gray-50 z-10 min-w-[180px]">
                    Date
                  </td>
                  {revenueData
                    .sort((a, b) => {
                      // Sort by parsing dates as local dates
                      const [aYear, aMonth, aDay] = a.entry_date.split('-').map(Number);
                      const [bYear, bMonth, bDay] = b.entry_date.split('-').map(Number);
                      const dateA = new Date(aYear, aMonth - 1, aDay);
                      const dateB = new Date(bYear, bMonth - 1, bDay);
                      return dateA - dateB;
                    })
                    .map((revenue) => {
                      const date = revenue.entry_date;
                      const isSelected = selectedDate && selectedDate === date;
                      
                      // Parse date as local date to avoid timezone shifts
                      const [year, month, day] = date.split('-').map(Number);
                      const localDate = new Date(year, month - 1, day);
                      
                      return (
                        <td
                          key={date}
                          className={`px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors min-w-[140px] ${
                            isSelected ? 'bg-blue-50 ring-2 ring-blue-400' : ''
                          }`}
                          onClick={() => onDateSelect && onDateSelect(date)}
                          title={`Click to open ${localDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} entry form`}
                        >
                          {localDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                      );
                    })}
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 bg-gray-100 sticky right-0 z-10">
                    -
                  </td>
                </tr>
                
                {/* Field Rows */}
                {[
                  { key: 'total_cash', label: 'Total Cash', getValue: (r) => formatCurrency(r.total_cash) },
                  { key: 'sales_tax', label: 'Sales Tax', getValue: (r) => formatCurrency(r.sales_tax_amount) },
                  { key: 'credit_card', label: 'Credit Card', getValue: (r) => formatCurrency(r.business_credit_card) },
                  { key: 'cc_fees', label: 'CC Fees', getValue: (r) => formatCurrency(r.credit_card_transaction_fees) },
                  { key: 'customer_credits', label: 'Customer Credits', getValue: (r, date) => formatCurrency(customerTabData[date]?.credits || 0) },
                  { key: 'customer_debits', label: 'Customer Debits', getValue: (r, date) => formatCurrency(customerTabData[date]?.debits || 0) },
                  { key: 'daily_business_amount', label: 'Daily Business Amount', getValue: (r, date) => formatCurrency(calculateDailyBusinessAmount(r, customerTabData[date] || {})), isBold: true, isHighlighted: true, bgColor: 'bg-green-50', textColor: 'text-green-800' },
                  { key: 'online_sales', label: 'Online Sales', getValue: (r) => formatCurrency(r.online_sales) },
                  { key: 'online_net', label: 'Online Net', getValue: (r) => formatCurrency(r.online_net) },
                  { key: 'total_instant', label: 'Total Instant', getValue: (r) => formatCurrency(r.total_instant) },
                  { key: 'instant_adjustment', label: 'Instant Adjustment', getValue: (r) => formatCurrency(r.total_instant_adjustment) },
                  { key: 'instant_pay', label: 'Instant Pay', getValue: (r) => formatCurrency(r.instant_pay) },
                  { key: 'lottery_cc', label: 'Lottery Card Trans', getValue: (r) => formatCurrency(r.lottery_credit_card) },
                  { key: 'weekly_lottery_commission', label: 'Weekly Lottery Commission', getValue: (r) => formatCurrency(r.weekly_lottery_commission), isHighlighted: true, bgColor: 'bg-purple-50', textColor: 'text-purple-800', isBold: true },
                  { key: 'thirteen_week_average', label: '13 Week Average', getValue: (r) => formatCurrency(r.thirteen_week_average), isHighlighted: true, bgColor: 'bg-purple-50', textColor: 'text-purple-800', isBold: true },
                  { key: 'weekly_lottery_due', label: 'Weekly Lottery Due', getValue: (r) => formatCurrency(r.weekly_lottery_due), isHighlighted: true, bgColor: 'bg-purple-50', textColor: 'text-purple-800', isBold: true },
                  { key: 'business_cash_on_hand', label: 'Business Cash On Hand', getValue: (r, date) => formatCurrency(cashOnHandData[date]?.businessCashOnHand || 0), color: 'text-blue-600', isBold: true },
                  { key: 'lottery_cash_on_hand', label: 'Lottery Cash On Hand', getValue: (r, date) => formatCurrency(cashOnHandData[date]?.lotteryCashOnHand || 0), color: 'text-purple-600', isBold: true },
                ].map((field) => {
                  const sortedRevenues = [...revenueData].sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date));
                  let totalValue = 0;
                  
                  if (field.key === 'total_cash') totalValue = totals.totalCash;
                  else if (field.key === 'sales_tax') totalValue = totals.salesTax;
                  else if (field.key === 'credit_card') totalValue = totals.creditCard;
                  else if (field.key === 'cc_fees') totalValue = totals.creditCardFees;
                  else if (field.key === 'customer_credits') totalValue = totals.customerCredits;
                  else if (field.key === 'customer_debits') totalValue = totals.customerDebits;
                  else if (field.key === 'online_sales') totalValue = totals.onlineSales;
                  else if (field.key === 'online_net') totalValue = totals.onlineNet;
                  else if (field.key === 'total_instant') totalValue = totals.totalInstant;
                  else if (field.key === 'instant_adjustment') totalValue = totals.instantAdjustment;
                  else if (field.key === 'instant_pay') totalValue = totals.instantPay;
                  else if (field.key === 'lottery_cc') totalValue = totals.lotteryCreditCard;
                  else if (field.key === 'weekly_lottery_commission') totalValue = totals.weeklyLotteryCommission;
                  else if (field.key === 'thirteen_week_average') totalValue = totals.thirteenWeekAverage;
                  else if (field.key === 'weekly_lottery_due') totalValue = totals.weeklyLotteryDue;
                  else if (field.key === 'daily_business_amount') totalValue = totals.dailyBusiness;
                  else if (field.key === 'business_cash_on_hand') totalValue = totals.businessCashOnHand;
                  else if (field.key === 'lottery_cash_on_hand') totalValue = totals.lotteryCashOnHand;
                  
                  // For Daily Business Amount, determine color based on comparison with Credit Card Sales
                  let rowBgColor = field.isHighlighted ? (field.bgColor || 'bg-green-50') : '';
                  let rowTextColor = field.isHighlighted ? (field.textColor || 'text-green-800') : '';
                  
                  // Special logic for Daily Business Amount: compare with Credit Card Sales
                  if (field.key === 'daily_business_amount') {
                    // Check totals first
                    const dailyBusinessTotal = totals.dailyBusiness;
                    const creditCardTotal = totals.creditCard;
                    const isTotalValid = dailyBusinessTotal > creditCardTotal;
                    
                    return (
                      <tr key={field.key} className="hover:bg-gray-50">
                        <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium sticky left-0 z-10 min-w-[180px] ${
                          isTotalValid ? 'text-green-800' : 'text-red-800'
                        } font-bold ${isTotalValid ? 'bg-green-50' : 'bg-red-50'}`}>
                          {field.label}
                        </td>
                        {sortedRevenues.map((revenue) => {
                          const date = revenue.entry_date;
                          const isSelected = selectedDate && selectedDate === date;
                          const dailyBusinessValue = calculateDailyBusinessAmount(revenue, customerTabData[date] || {});
                          const creditCard = parseFloat(revenue.business_credit_card || 0);
                          const isValid = dailyBusinessValue > creditCard;
                          const cellBgColor = isValid ? 'bg-green-50' : 'bg-red-50';
                          const cellTextColor = isValid ? 'text-green-800' : 'text-red-800';
                          const value = field.getValue(revenue, date);
                          
                          return (
                            <td
                              key={date}
                              className={`px-4 py-3 whitespace-nowrap text-sm text-center cursor-pointer font-semibold hover:opacity-80 transition-opacity min-w-[140px] ${
                                isSelected ? 'ring-2 ring-blue-400' : ''
                              } ${cellBgColor} ${cellTextColor}`}
                              onClick={() => onDateSelect && onDateSelect(date)}
                              title={`Click to open ${new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} entry form. ${isValid ? 'Daily Business Amount is greater than Credit Card Sales' : 'Warning: Daily Business Amount is less than or equal to Credit Card Sales'}`}
                            >
                              {value}
                            </td>
                          );
                        })}
                        <td className={`px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-gray-100 sticky right-0 z-10 ${
                          isTotalValid ? 'text-green-800' : 'text-red-800'
                        }`}>
                          ${formatCurrency(totalValue)}
                        </td>
                      </tr>
                    );
                  }
                  
                  return (
                    <tr key={field.key} className={`hover:bg-gray-50 ${rowBgColor}`}>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium sticky left-0 z-10 min-w-[180px] ${rowTextColor || 'text-gray-900'} ${field.isBold ? 'font-bold' : ''} ${rowBgColor || 'bg-white'}`}>
                        {field.label}
                      </td>
                      {sortedRevenues.map((revenue) => {
                        const date = revenue.entry_date;
                        const isSelected = selectedDate && selectedDate === date;
                        // Always pass both parameters - functions that don't need date will ignore it
                        const value = field.getValue(revenue, date);
                        return (
                          <td
                            key={date}
                            className={`px-4 py-3 whitespace-nowrap text-sm text-center cursor-pointer hover:bg-gray-100 transition-colors min-w-[140px] ${
                              field.isHighlighted ? rowTextColor : (field.color || 'text-gray-900')
                            } ${field.isBold ? 'font-semibold' : ''} ${isSelected ? 'bg-blue-50 ring-2 ring-blue-400' : ''} ${rowBgColor || ''}`}
                            onClick={() => onDateSelect && onDateSelect(date)}
                            title={`Click to open ${new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} entry form`}
                          >
                            {value}
                          </td>
                        );
                      })}
                      <td className={`px-4 py-3 whitespace-nowrap text-sm text-center font-bold bg-gray-100 sticky right-0 z-10 ${
                        field.isHighlighted ? rowTextColor : (field.color || 'text-gray-900')
                      }`}>
                        ${formatCurrency(totalValue)}
                      </td>
                    </tr>
                  );
                })}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DailyReportTable;

