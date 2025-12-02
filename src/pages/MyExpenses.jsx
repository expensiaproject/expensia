import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '../utils';
import { format } from 'date-fns';
import {
  Search,
  Eye,
  Receipt,
  FileText,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CATEGORIES, getCategoryLabel, formatCurrency, getPaymentMethodLabel } from '../components/shared/CategoryHelpers';
import {
  exportToExcel,
  exportToPDF,
  prepareExpenseDataForExport,
  generateExportFilename
} from '../components/shared/ExportUtils';
import { StatusBadge, CategoryBadge, ExportButtonGroup, PageHeader, EmptyState, LoadingSpinner } from '../components/shared/UIHelpers';

export default function MyExpenses() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialStatus = urlParams.get('status') || 'all';
  
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [viewDialog, setViewDialog] = useState({ open: false, expense: null });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['myExpenses', user?.id],
    queryFn: () => base44.entities.Expense.filter({ employeeId: user?.id }, '-date', 500),
    enabled: !!user?.id,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['myReports', user?.id],
    queryFn: () => base44.entities.Report.filter({ employeeId: user?.id }),
    enabled: !!user?.id,
  });

  const baseCurrency = 'USD';

  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = !search || 
      exp.merchant?.toLowerCase().includes(search.toLowerCase()) ||
      exp.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || exp.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || exp.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleExport = (type) => {
    const data = prepareExpenseDataForExport(filteredExpenses);
    const filename = generateExportFilename(type, false);
    
    if (type === 'excel') {
      exportToExcel(data, filename);
    } else if (type === 'pdf') {
      exportToPDF(data, 'My Expenses', filename);
    }
  };

  const getReportTitle = (reportId) => {
    if (!reportId) return null;
    const report = reports.find(r => r.id === reportId);
    return report?.title || 'Unknown Report';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <PageHeader title="My Expenses" subtitle={`${filteredExpenses.length} expenses`}>
        <Link to={createPageUrl('CreateTripReport')}>
          <Button className="bg-indigo-600 hover:bg-indigo-700 rounded-md font-medium h-10 px-6 w-full sm:w-auto">
            <FileText className="h-4 w-4 mr-2" />
            Create Trip Report
          </Button>
        </Link>
        <ExportButtonGroup onExport={handleExport} />
      </PageHeader>

      {/* Info Banner */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700">
          Expenses can only be created inside a Trip Report. To add a new expense, 
          <Link to={createPageUrl('CreateTripReport')} className="font-medium underline ml-1">create a new trip report</Link> or open an existing one from <Link to={createPageUrl('MyReports')} className="font-medium underline">My Reports</Link>.
        </AlertDescription>
      </Alert>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search expenses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-40">
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
              <SelectTrigger className="w-full sm:w-36">
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
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="bg-gray-50 border-b border-gray-200">
                <TableHead className="font-semibold text-gray-700">Date</TableHead>
                <TableHead className="font-semibold text-gray-700">Merchant</TableHead>
                <TableHead className="font-semibold text-gray-700">Category</TableHead>
                <TableHead className="text-right font-semibold text-gray-700">Amount</TableHead>
                <TableHead className="font-semibold text-gray-700">Status</TableHead>
                <TableHead className="font-semibold text-gray-700">Report</TableHead>
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
                      description="Create a trip report to add your first expense"
                      action={
                        <Link to={createPageUrl('CreateTripReport')}>
                          <Button variant="link" className="text-indigo-600">Create a trip report</Button>
                        </Link>
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((expense, index) => (
                  <TableRow key={expense.id} className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <TableCell className="text-sm">
                      {expense.date ? format(new Date(expense.date), 'MMM d, yyyy') : '-'}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{expense.merchant}</TableCell>
                    <TableCell>
                      <CategoryBadge category={expense.category} label={getCategoryLabel(expense.category)} />
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-sm">
                      {formatCurrency(expense.amount, expense.currency || baseCurrency)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={expense.status} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {expense.reportId ? (
                        <Link 
                          to={createPageUrl(`TripReportDetails?id=${expense.reportId}`)}
                          className="text-indigo-600 hover:underline"
                        >
                          {getReportTitle(expense.reportId)}
                        </Link>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setViewDialog({ open: true, expense })}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
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
              {viewDialog.expense.receiptUrl && (
                <div className="rounded-lg overflow-hidden border bg-gray-50">
                  {viewDialog.expense.receiptUrl.toLowerCase().includes('.pdf') ? (
                    <div className="p-6 text-center">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">PDF Receipt</p>
                      <a 
                        href={viewDialog.expense.receiptUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-indigo-600 text-sm hover:underline"
                      >
                        View PDF
                      </a>
                    </div>
                  ) : (
                    <img 
                      src={viewDialog.expense.receiptUrl} 
                      alt="Receipt" 
                      className="w-full max-h-48 object-contain"
                    />
                  )}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Merchant</p>
                  <p className="font-medium">{viewDialog.expense.merchant}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <StatusBadge status={viewDialog.expense.status} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Date</p>
                  <p className="font-medium">
                    {viewDialog.expense.date ? format(new Date(viewDialog.expense.date), 'MMM d, yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Category</p>
                  <CategoryBadge category={viewDialog.expense.category} label={getCategoryLabel(viewDialog.expense.category)} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Amount</p>
                  <p className="font-semibold text-lg text-indigo-600">
                    {formatCurrency(viewDialog.expense.amount, viewDialog.expense.currency || baseCurrency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Payment Method</p>
                  <p className="font-medium">{getPaymentMethodLabel(viewDialog.expense.paymentMethod)}</p>
                </div>
                {viewDialog.expense.taxAmount && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Tax Amount</p>
                    <p className="font-medium">{formatCurrency(viewDialog.expense.taxAmount, viewDialog.expense.currency || baseCurrency)}</p>
                  </div>
                )}
                {viewDialog.expense.reportId && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Report</p>
                    <Link 
                      to={createPageUrl(`TripReportDetails?id=${viewDialog.expense.reportId}`)}
                      className="text-indigo-600 hover:underline font-medium"
                    >
                      {getReportTitle(viewDialog.expense.reportId)}
                    </Link>
                  </div>
                )}
              </div>

              {viewDialog.expense.description && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Description</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{viewDialog.expense.description}</p>
                </div>
              )}

              {viewDialog.expense.policyFlags && viewDialog.expense.policyFlags.length > 0 && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs text-amber-700 font-medium mb-1">Policy Warnings</p>
                  <ul className="text-sm text-amber-600 list-disc list-inside">
                    {viewDialog.expense.policyFlags.map((flag, i) => (
                      <li key={i}>{flag}</li>
                    ))}
                  </ul>
                </div>
              )}

              {viewDialog.expense.reportId && viewDialog.expense.status === 'draft' && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-gray-500 mb-2">To edit or delete this expense, open it from the trip report:</p>
                  <Link to={createPageUrl(`TripReportDetails?id=${viewDialog.expense.reportId}`)}>
                    <Button variant="outline" size="sm" className="w-full">
                      Open in Report
                    </Button>
                  </Link>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setViewDialog({ open: false, expense: null })}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}