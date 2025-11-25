import React from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '../utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { 
  Receipt, 
  FileText, 
  Plus, 
  Download,
  DollarSign,
  Clock,
  CheckCircle2,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StatsCard from '../components/dashboard/StatsCard';
import CategoryChart from '../components/dashboard/CategoryChart';
import RecentExpenses from '../components/dashboard/RecentExpenses';
import { formatCurrency } from '../components/shared/CategoryHelpers';
import { 
  exportToCSV, 
  exportToExcel, 
  exportToPDF,
  prepareExpenseDataForExport,
  generateExportFilename
} from '../components/shared/ExportUtils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Home() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['myExpenses', user?.id],
    queryFn: () => base44.entities.Expense.filter({ employeeId: user?.id }, '-date', 100),
    enabled: !!user?.id,
  });

  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['myReports', user?.id],
    queryFn: () => base44.entities.Report.filter({ employeeId: user?.id }, '-created_date', 50),
    enabled: !!user?.id,
  });

  const baseCurrency = user?.baseCurrency || 'USD';
  
  // Calculate stats
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  
  const thisMonthExpenses = expenses.filter(exp => {
    const expDate = new Date(exp.date);
    return expDate >= monthStart && expDate <= monthEnd;
  });
  
  const reimbursedThisMonth = thisMonthExpenses
    .filter(exp => exp.status === 'reimbursed')
    .reduce((sum, exp) => sum + (exp.amountInBase || 0), 0);
    
  const pendingExpenses = expenses.filter(exp => exp.status === 'submitted');
  const pendingAmount = pendingExpenses.reduce((sum, exp) => sum + (exp.amountInBase || 0), 0);
  
  const openReports = reports.filter(r => r.status === 'open').length;
  const submittedReports = reports.filter(r => r.status === 'submitted').length;

  const handleExport = (type) => {
    const data = prepareExpenseDataForExport(expenses);
    const filename = generateExportFilename(type, false);
    
    switch (type) {
      case 'csv':
        exportToCSV(data, filename);
        break;
      case 'excel':
        exportToExcel(data, filename);
        break;
      case 'pdf':
        exportToPDF(data, 'My Expenses', filename);
        break;
    }
  };

  if (expensesLoading || reportsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            Welcome back, {user?.full_name?.split(' ')[0] || 'there'}
          </h1>
          <p className="text-gray-500 mt-1">Here's your expense overview for {format(now, 'MMMM yyyy')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={createPageUrl('NewExpense')}>
            <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200">
              <Plus className="h-4 w-4 mr-2" />
              New Expense
            </Button>
          </Link>
          <Link to={createPageUrl('NewReport')}>
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Create Report
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                Download CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel')}>
                Download Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                Download PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Reimbursed This Month"
          value={formatCurrency(reimbursedThisMonth, baseCurrency)}
          icon={CheckCircle2}
          color="green"
        />
        <StatsCard
          title="Pending Reimbursement"
          value={formatCurrency(pendingAmount, baseCurrency)}
          subtitle={`${pendingExpenses.length} expenses`}
          icon={Clock}
          color="amber"
        />
        <StatsCard
          title="Open Reports"
          value={openReports}
          subtitle="Not yet submitted"
          icon={FileText}
          color="purple"
        />
        <StatsCard
          title="Submitted Reports"
          value={submittedReports}
          subtitle="Awaiting payment"
          icon={TrendingUp}
          color="blue"
        />
      </div>

      {/* Charts and Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryChart expenses={thisMonthExpenses} baseCurrency={baseCurrency} />
        <RecentExpenses expenses={expenses} baseCurrency={baseCurrency} />
      </div>

      {/* Quick Tips */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-0">
        <CardContent className="p-6">
          <h3 className="font-semibold text-gray-900 mb-2">💡 Quick Tips</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Upload receipts to automatically extract expense details using AI</li>
            <li>• Group your expenses into reports for easier tracking and reimbursement</li>
            <li>• Use the AI Assistant to quickly query your expense history</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}