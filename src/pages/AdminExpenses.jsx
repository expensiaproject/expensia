import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Search,
  Download,
  Eye,
  MoreHorizontal,
  Receipt,
  AlertTriangle,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CATEGORIES,
  getCategoryLabel,
  formatCurrency,
  getPaymentMethodLabel
} from '../components/shared/CategoryHelpers';
import {
  exportToExcel,
  exportToPDF,
  prepareExpenseDataForExport,
  generateExportFilename
} from '../components/shared/ExportUtils';
import { StatusBadge, CategoryBadge, AdminExportButtonGroup, PageHeader, EmptyState, LoadingSpinner } from '../components/shared/UIHelpers';

export default function AdminExpenses() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewDialog, setViewDialog] = useState({ open: false, expense: null });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['allExpenses'],
    queryFn: () => base44.entities.Expense.list('-date', 1000),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });

  const baseCurrency = 'USD';

  const getUserName = (employeeId) => {
    const u = allUsers.find(u => u.id === employeeId);
    return u?.full_name || u?.email || 'Unknown';
  };

  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = !search || 
      exp.merchant?.toLowerCase().includes(search.toLowerCase()) ||
      exp.description?.toLowerCase().includes(search.toLowerCase()) ||
      getUserName(exp.employeeId)?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || exp.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || exp.status === statusFilter;
    const matchesUser = userFilter === 'all' || exp.employeeId === userFilter;
    
    let matchesDate = true;
    if (dateFrom) {
      matchesDate = matchesDate && new Date(exp.date) >= new Date(dateFrom);
    }
    if (dateTo) {
      matchesDate = matchesDate && new Date(exp.date) <= new Date(dateTo);
    }
    
    return matchesSearch && matchesCategory && matchesStatus && matchesUser && matchesDate;
  });

  const handleExport = (type) => {
    const data = prepareExpenseDataForExport(filteredExpenses);
    const filename = generateExportFilename(type, true);
    
    if (type === 'excel') {
      exportToExcel(data, filename);
    } else if (type === 'pdf') {
      exportToPDF(data, 'All Expenses Report', filename);
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
      <PageHeader title="All Expenses" subtitle={`${filteredExpenses.length} expenses`}>
        <AdminExportButtonGroup onExport={handleExport} />
      </PageHeader>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search expenses, merchants, users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {allUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full lg:w-44">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="reimbursed">Reimbursed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-500">Date range:</span>
            </div>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full sm:w-40"
              placeholder="From"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full sm:w-40"
              placeholder="To"
            />
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="bg-gray-50 border-b border-gray-200">
                <TableHead className="font-semibold text-gray-700">Date</TableHead>
                <TableHead className="font-semibold text-gray-700">User</TableHead>
                <TableHead className="font-semibold text-gray-700">Merchant</TableHead>
                <TableHead className="font-semibold text-gray-700">Category</TableHead>
                <TableHead className="text-right font-semibold text-gray-700">Amount</TableHead>
                <TableHead className="font-semibold text-gray-700">Status</TableHead>
                <TableHead className="text-right font-semibold text-gray-700">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <LoadingSpinner />
                  </TableCell>
                </TableRow>
              ) : filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState 
                      icon={Receipt}
                      title="No expenses found"
                      description="Adjust your filters to see more results"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((expense, index) => (
                  <TableRow key={expense.id} className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <TableCell className="font-medium text-sm">
                      {expense.date && format(new Date(expense.date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{getUserName(expense.employeeId)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        {expense.merchant}
                        {expense.policyFlags?.length > 0 && (
                          <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={expense.category} label={getCategoryLabel(expense.category)} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div className="font-medium text-sm">
                        {formatCurrency(expense.amount, expense.currency || baseCurrency)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={expense.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setViewDialog({ open: true, expense })}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* View Dialog */}
      <Dialog open={viewDialog.open} onOpenChange={(open) => setViewDialog({ open, expense: null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Expense Details</DialogTitle>
          </DialogHeader>
          {viewDialog.expense && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">User</p>
                  <p className="font-medium">{getUserName(viewDialog.expense.employeeId)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">{format(new Date(viewDialog.expense.date), 'PPP')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Merchant</p>
                  <p className="font-medium">{viewDialog.expense.merchant}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Category</p>
                  <CategoryBadge category={viewDialog.expense.category} label={getCategoryLabel(viewDialog.expense.category)} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="font-medium">
                    {formatCurrency(viewDialog.expense.amount, viewDialog.expense.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Method</p>
                  <p className="font-medium">{getPaymentMethodLabel(viewDialog.expense.paymentMethod)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <StatusBadge status={viewDialog.expense.status} />
                </div>
              </div>
              {viewDialog.expense.description && (
                <div>
                  <p className="text-sm text-gray-500">Description</p>
                  <p className="font-medium">{viewDialog.expense.description}</p>
                </div>
              )}
              {viewDialog.expense.receiptUrl && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Receipt</p>
                  <img 
                    src={viewDialog.expense.receiptUrl} 
                    alt="Receipt" 
                    className="max-h-64 rounded-lg border"
                  />
                </div>
              )}
              {viewDialog.expense.policyFlags?.length > 0 && (
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Policy Flags
                  </p>
                  <ul className="text-sm text-amber-700 mt-1 list-disc list-inside">
                    {viewDialog.expense.policyFlags.map((flag, i) => (
                      <li key={i}>{flag}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}