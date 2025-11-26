import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '../utils';
import { format } from 'date-fns';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  MoreHorizontal,
  Receipt,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CATEGORIES,
  getCategoryLabel,
  getCategoryColor,
  getStatusColor,
  formatCurrency,
  getPaymentMethodLabel
} from '../components/shared/CategoryHelpers';
import {
  exportToExcel,
  exportToPDF,
  prepareExpenseDataForExport,
  generateExportFilename
} from '../components/shared/ExportUtils';
import { logAuditEvent } from '../components/shared/AuditLogger';
import { StatusBadge, CategoryBadge, ExportButtonGroup, PageHeader, EmptyState, LoadingSpinner } from '../components/shared/UIHelpers';

export default function MyExpenses() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, expense: null });
  const [viewDialog, setViewDialog] = useState({ open: false, expense: null });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['myExpenses', user?.id],
    queryFn: () => base44.entities.Expense.filter({ employeeId: user?.id }, '-date', 200),
    enabled: !!user?.id,
  });

  const baseCurrency = user?.baseCurrency || 'USD';

  const deleteMutation = useMutation({
    mutationFn: async (expenseId) => {
      await base44.entities.Expense.delete(expenseId);
      await logAuditEvent(user, 'expense', expenseId, 'delete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myExpenses'] });
      setDeleteDialog({ open: false, expense: null });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (expense) => {
      await base44.entities.Expense.update(expense.id, { status: 'submitted' });
      await logAuditEvent(user, 'expense', expense.id, 'submit', { from: 'draft', to: 'submitted' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myExpenses'] });
    },
  });

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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <PageHeader title="My Expenses" subtitle={`${filteredExpenses.length} expenses`}>
        <Link to={createPageUrl('NewExpense')}>
          <Button className="bg-indigo-600 hover:bg-indigo-700 rounded-md font-medium h-10 px-6 w-full sm:w-[180px]">
            <Plus className="h-4 w-4 mr-2" />
            New Expense
          </Button>
        </Link>
        <ExportButtonGroup onExport={handleExport} />
      </PageHeader>

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
              <SelectTrigger className="w-full sm:w-44">
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
                <TableHead className="text-right font-semibold text-gray-700">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <LoadingSpinner />
                  </TableCell>
                </TableRow>
              ) : filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState 
                      icon={Receipt}
                      title="No expenses found"
                      description="Get started by adding your first expense"
                      action={
                        <Link to={createPageUrl('NewExpense')}>
                          <Button variant="link" className="text-indigo-600">Add your first expense</Button>
                        </Link>
                      }
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
                      <div className="flex items-center gap-2 text-sm">
                        {expense.merchant}
                        {expense.receiptUrl && (
                          <Receipt className="h-3.5 w-3.5 text-gray-400" />
                        )}
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
                        {formatCurrency(expense.amountInBase, baseCurrency)}
                      </div>
                      {expense.originalCurrency !== baseCurrency && (
                        <div className="text-xs text-gray-500">
                          {formatCurrency(expense.originalAmount, expense.originalCurrency)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={expense.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewDialog({ open: true, expense })}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {expense.status === 'draft' && (
                            <>
                              <DropdownMenuItem asChild>
                                <Link to={`${createPageUrl('EditExpense')}?id=${expense.id}`}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => submitMutation.mutate(expense)}>
                                <Receipt className="h-4 w-4 mr-2" />
                                Submit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => setDeleteDialog({ open: true, expense })}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">{format(new Date(viewDialog.expense.date), 'PPP')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Merchant</p>
                  <p className="font-medium">{viewDialog.expense.merchant}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <Badge className={getCategoryColor(viewDialog.expense.category)}>
                    {getCategoryLabel(viewDialog.expense.category)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <Badge className={getStatusColor(viewDialog.expense.status)}>
                    {viewDialog.expense.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Original Amount</p>
                  <p className="font-medium">
                    {formatCurrency(viewDialog.expense.originalAmount, viewDialog.expense.originalCurrency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Amount in Base</p>
                  <p className="font-medium">
                    {formatCurrency(viewDialog.expense.amountInBase, viewDialog.expense.baseCurrency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Method</p>
                  <p className="font-medium">{getPaymentMethodLabel(viewDialog.expense.paymentMethod)}</p>
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

      {/* Delete Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, expense: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialog({ open: false, expense: null })}
              className="w-full sm:w-[140px] h-10 rounded-md font-medium"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteDialog.expense && deleteMutation.mutate(deleteDialog.expense.id)}
              className="w-full sm:w-[140px] h-10 rounded-md font-medium"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}