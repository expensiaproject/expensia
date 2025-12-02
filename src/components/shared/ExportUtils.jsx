import { getCategoryLabel, getPaymentMethodLabel, getStatusColor } from './CategoryHelpers';
import { format } from 'date-fns';

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

export const prepareExpenseDataForExport = (expenses) => {
  return expenses.map(exp => ({
    'Date': formatDateForExport(exp.date),
    'Merchant': exp.merchant || '',
    'Category': getCategoryLabel(exp.category),
    'Description': exp.description || '',
    'Amount': exp.amount || 0,
    'Currency': exp.currency || 'USD',
    'Tax Amount': exp.taxAmount || '',
    'Payment Method': getPaymentMethodLabel(exp.paymentMethod),
    'Status': exp.status || 'draft',
    'Report ID': exp.reportId || '',
    'Policy Flags': (exp.policyFlags || []).join('; ')
  }));
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

export const exportToExcel = (data, filename) => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }
  
  const headers = Object.keys(data[0]);
  
  // Build CSV content with proper escaping
  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  
  let csv = '\uFEFF'; // BOM for Excel UTF-8 support
  csv += headers.map(escapeCSV).join(',') + '\n';
  
  data.forEach(row => {
    csv += headers.map(h => escapeCSV(row[h])).join(',') + '\n';
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename.replace('.xlsx', '.csv'));
};

export const exportToPDF = (data, title, filename) => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }
  
  const headers = Object.keys(data[0]);
  
  // Expensia logo SVG for PDF header
  const logoSVG = `
    <svg width="36" height="36" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 10px;">
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#4F46E5"/>
          <stop offset="100%" style="stop-color:#9333EA"/>
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#logoGradient)"/>
      <g transform="translate(8, 8)" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="18" x2="12" y2="12"/>
        <line x1="9" y1="15" x2="15" y2="15"/>
      </g>
    </svg>`;
  
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
        .header { margin-bottom: 20px; display: flex; align-items: center; }
        .logo-text { display: flex; flex-direction: column; }
        h1 { 
          background: linear-gradient(135deg, #4F46E5 0%, #9333EA 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-size: 24px; 
          margin-bottom: 2px; 
          font-weight: 700;
        }
        .subtitle { color: #6b7280; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10px; }
        th { background-color: #4F46E5; color: white; padding: 8px 6px; text-align: left; font-weight: 600; }
        td { padding: 6px; border-bottom: 1px solid #e5e7eb; }
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
        ${logoSVG}
        <div class="logo-text">
          <h1>Expensia</h1>
          <div class="subtitle">${title} • Generated on ${format(new Date(), 'MMMM d, yyyy')}</div>
        </div>
      </div>
      <table>
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${data.map(row => `<tr>${headers.map(h => `<td>${row[h] !== null && row[h] !== undefined ? row[h] : ''}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
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