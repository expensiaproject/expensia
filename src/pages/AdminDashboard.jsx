import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '../utils';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import {
  Receipt,
  FileText,
  Users,
  Download,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import StatsCard from '../components/dashboard/StatsCard';
import CategoryChart from '../components/dashboard/CategoryChart';
import { CATEGORIES, formatCurrency, getCategoryLabel } from '../components/shared/CategoryHelpers';
import {
  exportToCSV,
  exportToExcel,
  exportToPDF,
  prepareExpenseDataForExport,
  generateExportFilename
} from '../components/shared/ExportUtils';
import { ExportButtonGroup, PageHeader, LoadingSpinner } from '../components/shared/UIHelpers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#4F46E5', '#7C3AED', '#EC4899', '#F59E0B', '#10B981'];

export default function AdminDashboard() {
  const [periodFilter, setPeriodFilter] = useState('this_month');

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: allExpenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['allExpenses'],
    queryFn: () => base44.entities.Expense.list('-date', 1000),
  });

  const { data: allReports = [] } = useQuery({
    queryKey: ['allReports'],
    queryFn: () => base44.entities.Report.list('-created_date', 500),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });

  const baseCurrency = 'SGD';

  // Date filtering
  const now = new Date();
  const getDateRange = () => {
    switch (periodFilter) {
      case 'this_month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last_month':
        return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
      case 'last_3_months':
        return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
      case 'all':
      default:
        return { start: new Date(2020, 0, 1), end: now };
    }
  };

  const { start, end } = getDateRange();
  const filteredExpenses = allExpenses.filter(exp => {
    const expDate = new Date(exp.date);
    return expDate >= start && expDate <= end;
  });

  // Calculate stats
  const totalSpend = filteredExpenses.reduce((sum, e) => sum + (e.amountInBase || 0), 0);
  const submittedReports = allReports.filter(r => r.status === 'submitted').length;
  const paidReports = allReports.filter(r => r.status === 'paid').length;
  const policyViolations = filteredExpenses.filter(e => e.policyFlags?.length > 0).length;

  // Category breakdown
  const categoryData = CATEGORIES.map(cat => {
    const catExpenses = filteredExpenses.filter(e => e.category === cat.value);
    return {
      name: cat.label,
      value: catExpenses.reduce((sum, e) => sum + (e.amountInBase || 0), 0),
      count: catExpenses.length
    };
  }).filter(c => c.value > 0).sort((a, b) => b.value - a.value);

  // Cost center breakdown
  const costCenterData = {};
  filteredExpenses.forEach(exp => {
    const cc = exp.costCenter || 'Unassigned';
    if (!costCenterData[cc]) costCenterData[cc] = 0;
    costCenterData[cc] += exp.amountInBase || 0;
  });
  const costCenterChartData = Object.entries(costCenterData)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const handleExport = (type) => {
    const data = prepareExpenseDataForExport(filteredExpenses);
    const filename = generateExportFilename(type, true);
    
    switch (type) {
      case 'csv':
        exportToCSV(data, filename);
        break;
      case 'excel':
        exportToExcel(data, filename);
        break;
      case 'pdf':
        exportToPDF(data, 'All Expenses Report', filename);
        break;
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm text-gray-500">Access denied. Admin only.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <PageHeader title="Admin Dashboard" subtitle="Company-wide expense overview">
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-40 h-10 rounded-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
            <SelectItem value="last_3_months">Last 3 Months</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
        <ExportButtonGroup onExport={handleExport} />
      </PageHeader>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr">
        <StatsCard
          title="Total Company Spend"
          value={formatCurrency(totalSpend, baseCurrency)}
          icon={DollarSign}
          color="indigo"
        />
        <StatsCard
          title="Submitted Reports"
          value={submittedReports}
          subtitle="Awaiting payment"
          icon={FileText}
          color="amber"
        />
        <StatsCard
          title="Paid Reports"
          value={paidReports}
          icon={TrendingUp}
          color="green"
        />
        <StatsCard
          title="Policy Violations"
          value={policyViolations}
          subtitle="Expenses with flags"
          icon={AlertTriangle}
          color="rose"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <Card className="border-0 shadow-sm rounded-xl">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="text-lg font-semibold">Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData.slice(0, 6)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value) => [`$${value.toLocaleString()}`, 'Amount']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#4F46E5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cost Center Breakdown */}
        <Card className="border-0 shadow-sm rounded-xl">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="text-lg font-semibold">Spending by Cost Center</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={costCenterChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {costCenterChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => [`$${value.toLocaleString()}`, 'Amount']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to={createPageUrl('AdminExpenses')}>
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer rounded-xl h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Receipt className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-gray-900">All Expenses</p>
                <p className="text-xs text-gray-500">{allExpenses.length} total</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        
        <Link to={createPageUrl('AdminReports')}>
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer rounded-xl h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-gray-900">All Reports</p>
                <p className="text-xs text-gray-500">{allReports.length} total</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        
        <Link to={createPageUrl('AdminUsers')}>
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer rounded-xl h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-gray-900">Users</p>
                <p className="text-xs text-gray-500">{allUsers.length} total</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        
        <Link to={createPageUrl('AdminAuditLogs')}>
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer rounded-xl h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-5 w-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-gray-900">Audit Logs</p>
                <p className="text-xs text-gray-500">View activity</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Policy Violations */}
      {policyViolations > 0 && (
        <Card className="border-0 shadow-sm rounded-xl">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Recent Policy Violations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredExpenses
                .filter(e => e.policyFlags?.length > 0)
                .slice(0, 5)
                .map(expense => (
                  <div key={expense.id} className="p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{expense.merchant}</p>
                        <p className="text-sm text-gray-500">
                          {expense.date && format(new Date(expense.date), 'MMM d, yyyy')} • {getCategoryLabel(expense.category)}
                        </p>
                      </div>
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(expense.amountInBase, baseCurrency)}
                      </p>
                    </div>
                    <div className="mt-2 text-sm text-amber-700">
                      {expense.policyFlags.map((flag, i) => (
                        <p key={i}>• {flag}</p>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}