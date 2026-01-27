import { getCategoryLabel, getPaymentMethodLabel, getStatusColor, getCurrencySymbol } from './CategoryHelpers';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

export const formatDateForExport = (date) => {
  if (!date) return '';
  return format(new Date(date), 'yyyy-MM-dd');
};

export const generateExportFilename = (type, isAdmin = false) => {
  const dateStr = format(new Date(), 'yyyyMMdd');
  const userType = isAdmin ? 'Admin' : 'User';
  
  switch (type) {
    case 'excel':
      return `Expensia_Export_${userType}_${dateStr}.xlsx`;
    case 'pdf':
      return `Expensia_Report_${userType}_${dateStr}.pdf`;
    default:
      return `Expensia_Export_${userType}_${dateStr}`;
  }
};

const getExportCategoryLabel = (category) => {
  const categoryMap = {
    'air_tickets': 'International Airfare',
    'local_transport': 'Local Transport',
    'overseas_transport': 'Oversea Transport',
    'lodging': 'Accommodation',
    'communication': 'Comms and Logistics',
    'entertainment_hospitality': 'Entertainment',
    'meals': 'Drinks',
    'gifts_souvenirs': 'Gift',
    'trip_insurance': 'Miscs',
    'equipment_tools': 'Miscs',
    'health': 'Miscs',
    'other_business': 'Miscs',
    'miscellaneous': 'Miscs'
  };
  return categoryMap[category] || 'Miscs';
};

const formatAmountForExport = (amount, currency) => {
  if (!amount && amount !== 0) return '';
  
  // For IDR, no decimals, use thousand separators
  if (currency === 'IDR') {
    const formatted = Math.round(amount).toLocaleString('en-US');
    return `${currency} ${formatted}`;
  }
  
  // For other currencies, 2 decimals
  return amount.toFixed(2);
};

export const prepareExpenseDataForExport = (expenses, tripCurrency = 'USD') => {
  // Detect if all expenses use the same currency
  const currencies = [...new Set(expenses.map(exp => exp.currency || 'USD'))];
  const isSingleCurrency = currencies.length === 1;
  
  const mapped = expenses.map(exp => {
    const expCurrency = exp.currency || 'USD';
    const amount = exp.amount || 0;
    
    const baseData = {
      'Date': formatDateForExport(exp.date),
      'Merchant': exp.merchant || '',
      'Category': getExportCategoryLabel(exp.category),
      'Description': exp.description || '',
      'Amount': formatAmountForExport(amount, expCurrency)
    };

    // Only add Currency column if multiple currencies are present
    if (!isSingleCurrency) {
      baseData['Currency'] = expCurrency;
    }

    baseData['Payment Method'] = getPaymentMethodLabel(exp.paymentMethod);
    baseData['Status'] = exp.status || 'draft';

    return baseData;
  });

  // Sort by date ascending
  return mapped.sort((a, b) => a.Date.localeCompare(b.Date));
};

export const prepareReportDataForExport = (reports) => {
  return reports.map(rep => ({
    'Title': rep.title || '',
    'Trip Start': formatDateForExport(rep.tripStartDate),
    'Trip End': formatDateForExport(rep.tripEndDate),
    'Travelers': rep.travelerCount || 1,
    'Destination': rep.destination || '',
    'Total Amount': rep.totalAmount || 0,
    'Status': rep.status || 'open',
    'Notes': rep.notes || '',
    'Created': formatDateForExport(rep.created_date)
  }));
};

const getCategoryColor = (category) => {
  const colorMap = {
    'International Airfare': 'D6EAF8',
    'Domestic Airfare': 'D5F4E6',
    'Local Transport': 'FCF3CF',
    'Oversea Transport': 'FAE5D3',
    'Accommodation': 'E8DAEF',
    'Comms and Logistics': 'D5F4E6',
    'Entertainment': 'FADBD8',
    'Drinks': 'F9E79F',
    'Gift': 'F8C471',
    'Miscs': 'D5DBDB'
  };
  return colorMap[category] || 'FFFFFF';
};

export const exportToExcel = (data, filename) => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }
  
  const headers = Object.keys(data[0]);
  
  // Create worksheet data with headers
  const wsData = [headers];
  data.forEach(row => {
    wsData.push(headers.map(h => row[h]));
  });
  
  // Calculate summary
  const totalExpenses = data.length;
  const amountsByCurrency = {};
  data.forEach(row => {
    const amountStr = row['Amount'];
    if (amountStr) {
      // Parse "IDR 1,701,499" or "12.50" format
      const match = amountStr.match(/^([A-Z]{3})\s+([\d,]+(?:\.\d{2})?)$|^([\d,]+(?:\.\d{2})?)$/);
      if (match) {
        const currency = match[1] || (row['Currency'] || 'USD');
        const amount = parseFloat((match[2] || match[3]).replace(/,/g, ''));
        amountsByCurrency[currency] = (amountsByCurrency[currency] || 0) + amount;
      }
    }
  });
  
  // Add summary rows
  wsData.push([]);
  wsData.push(['Total Expenses:', totalExpenses]);
  wsData.push(['Total Amount:']);
  Object.entries(amountsByCurrency).forEach(([currency, amount]) => {
    const formatted = formatAmountForExport(amount, currency);
    wsData.push(['', formatted]);
  });
  
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 12 }, // Date
    { wch: 25 }, // Merchant
    { wch: 20 }, // Category
    { wch: 30 }, // Description
    { wch: 12 }, // Amount
    { wch: 10 }, // Currency
    { wch: 12 }, // FX Rate
    { wch: 15 }, // Base Amount
    { wch: 12 }, // Tax Amount
    { wch: 15 }, // Payment Method
    { wch: 12 }, // Status
    { wch: 15 }, // Report ID
    { wch: 30 }  // Policy Flags
  ];
  
  // Style header row
  headers.forEach((header, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    if (!ws[cellRef]) ws[cellRef] = { t: 's', v: header };
    ws[cellRef].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '4F46E5' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
  });
  
  const amountColIdx = headers.indexOf('Amount');
  
  // Apply category colors to data rows and right-align amounts
  data.forEach((row, rowIdx) => {
    const categoryColIdx = headers.indexOf('Category');
    const category = row['Category'];
    const bgColor = getCategoryColor(category);
    
    headers.forEach((header, colIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx + 1, c: colIdx });
      if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
      
      // Right-align amount columns
      const isAmountColumn = colIdx === amountColIdx;
      
      ws[cellRef].s = {
        fill: { fgColor: { rgb: bgColor } },
        alignment: { 
          vertical: 'center',
          horizontal: isAmountColumn ? 'right' : 'left'
        }
      };
    });
  });
  
  XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
  XLSX.writeFile(wb, filename);
};

const LOGO_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/692525e8f1598b43ae001573/312e69aa4_image.png';

export const exportToPDF = (data, title, filename) => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }
  
  const headers = Object.keys(data[0]);
  
  // Create a printable HTML document that triggers print dialog for Save as PDF
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1f2937; }
        .header { margin-bottom: 20px; display: flex; align-items: center; gap: 12px; }
        .header img { height: 50px; width: auto; }
        .subtitle { color: #6b7280; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10px; }
        th { background-color: #4F46E5; color: white; padding: 8px 6px; text-align: left; font-weight: 600; }
        td { padding: 6px; border-bottom: 1px solid #e5e7eb; }
        td.amount { text-align: right; }
        tr:nth-child(even) { background-color: #f9fafb; }
        .footer { margin-top: 20px; font-size: 9px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 10px; }
        @page { size: A4 landscape; margin: 15mm; }
        @media print {
          body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="${LOGO_URL}" alt="Expensia" />
        <div class="subtitle">${title} • Generated on ${format(new Date(), 'MMMM d, yyyy')}</div>
      </div>
      <table>
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${data.map(row => `<tr>${headers.map(h => `<td class="${h === 'Amount' ? 'amount' : ''}">${row[h] !== null && row[h] !== undefined ? row[h] : ''}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
      <div class="summary" style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #4F46E5;">
        <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 10px; color: #1f2937;">Summary</h3>
        <div style="display: flex; gap: 40px;">
          <div>
            <p style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">Total Expenses</p>
            <p style="font-size: 16px; font-weight: 600; color: #1f2937;">${data.length}</p>
          </div>
          <div>
            <p style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">Total Amount</p>
            ${(() => {
              const amountsByCurrency = {};
              data.forEach(row => {
                const amountStr = row['Amount'];
                if (amountStr) {
                  const match = amountStr.match(/^([A-Z]{3})\\s+([\\d,]+(?:\\.\\d{2})?)$|^([\\d,]+(?:\\.\\d{2})?)$/);
                  if (match) {
                    const currency = match[1] || (row['Currency'] || 'USD');
                    const amount = parseFloat((match[2] || match[3]).replace(/,/g, ''));
                    amountsByCurrency[currency] = (amountsByCurrency[currency] || 0) + amount;
                  }
                }
              });
              return Object.entries(amountsByCurrency).map(([currency, amount]) => {
                const symbol = getCurrencySymbol(currency);
                const formatted = currency === 'IDR' 
                  ? Math.round(amount).toLocaleString('en-US')
                  : amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return `<p style="font-size: 16px; font-weight: 600; color: #4F46E5;">${symbol} ${formatted}</p>`;
              }).join('');
            })()}
          </div>
        </div>
      </div>
      <div class="footer">This document was generated by Expensia Expense Management System</div>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          }, 300);
        };
      </script>
    </body>
    </html>`;
  
  const printWindow = window.open('', '_blank', 'width=1200,height=800');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
};

const downloadBlob = (blob, filename) => {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};