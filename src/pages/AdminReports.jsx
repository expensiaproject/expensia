import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Search,
  Eye,
  MoreHorizontal,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  DollarSign
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
  formatCurrency,
  getCategoryLabel
} from '../components/shared/CategoryHelpers';
import {
  exportToExcel,
  exportToPDF,
  prepareReportDataForExport,
  prepareExpenseDataForExport,
  generateExportFilename
} from '../components/shared/ExportUtils';
import { logAuditEvent } from '../components/shared/AuditLogger';
import { StatusBadge, CategoryBadge, AdminExportButtonGroup, PageHeader, EmptyState, LoadingSpinner } from '../components/shared/UIHelpers';

export default function AdminReports() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const initialStatus = urlParams.get('status') || 'all';
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [userFilter, setUserFilter] = useState('all');
  const [viewDialog, setViewDialog] = useState({ open: false, report: null });
  const [payDialog, setPayDialog] = useState({ open: false, report: null });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['allReports'],
    queryFn: () => base44.entities.Report.list('-created_date', 500),
  });

  const { data: allExpenses = [] } = useQuery({
    queryKey: ['allExpenses'],
    queryFn: () => base44.entities.Expense.list('-date', 2000),
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

  const getReportExpenses = (reportId) => {
    return allExpenses.filter(e => e.reportId === reportId);
  };

  const markAsPaidMutation = useMutation({
    mutationFn: async (report) => {
      // Update report status
      await base44.entities.Report.update(report.id, { status: 'paid' });
      
      // Update all linked expenses to reimbursed
      const linkedExpenses = allExpenses.filter(e => e.reportId === report.id);
      for (const exp of linkedExpenses) {
        await base44.entities.Expense.update(exp.id, { status: 'reimbursed' });
      }
      
      await logAuditEvent(user, 'report', report.id, 'approve', { status: 'paid', expensesReimbursed: linkedExpenses.length });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allReports'] });
      queryClient.invalidateQueries({ queryKey: ['allExpenses'] });
      setPayDialog({ open: false, report: null });
    },
  });

  const filteredReports = reports.filter(rep => {
    const matchesSearch = !search || 
      rep.title?.toLowerCase().includes(search.toLowerCase()) ||
      getUserName(rep.employeeId)?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || rep.status === statusFilter;
    const matchesUser = userFilter === 'all' || rep.employeeId === userFilter;
    return matchesSearch && matchesStatus && matchesUser;
  });

  const handleExport = (type) => {
    const data = prepareReportDataForExport(filteredReports);
    const filename = generateExportFilename(type, true).replace('Export', 'Reports');
    
    if (type === 'excel') {
      exportToExcel(data, filename);
    } else if (type === 'pdf') {
      exportToPDF(data, 'All Reports', filename);
    }
  };

  const handleExportReportExpenses = (report, type) => {
    const expenses = getReportExpenses(report.id);
    const data = prepareExpenseDataForExport(expenses);
    const filename = `Expensia_Report_${report.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}`;
    
    if (type === 'excel') {
      exportToExcel(data, `${filename}.xlsx`);
    } else if (type === 'pdf') {
      exportToPDF(data, `Report: ${report.title}`, `${filename}.pdf`);
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
      <PageHeader title="All Reports" subtitle={`${filteredReports.length} reports`}>
        <AdminExportButtonGroup onExport={handleExport} />
      </PageHeader>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search reports..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {allUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
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
                <TableHead className="font-semibold text-gray-700">Title</TableHead>
                <TableHead className="font-semibold text-gray-700">User</TableHead>
                <TableHead className="font-semibold text-gray-700">Period</TableHead>
                <TableHead className="font-semibold text-gray-700">Expenses</TableHead>
                <TableHead className="text-right font-semibold text-gray-700">Total</TableHead>
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
              ) : filteredReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState 
                      icon={FileText}
                      title="No reports found"
                      description="Adjust your filters to see more results"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredReports.map((report, index) => {
                  const reportExpenses = getReportExpenses(report.id);
                  return (
                    <TableRow key={report.id} className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <TableCell className="font-medium text-sm">{report.title}</TableCell>
                      <TableCell>
                        <span className="text-sm">{getUserName(report.employeeId)}</span>
                      </TableCell>
                      <TableCell>
                        {report.periodStart && report.periodEnd ? (
                          <span className="text-sm text-gray-600">
                            {format(new Date(report.periodStart), 'MMM d')} - {format(new Date(report.periodEnd), 'MMM d, yyyy')}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-sm">{reportExpenses.length} expenses</TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-sm">
                        {formatCurrency(report.totalAmount, baseCurrency)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={report.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewDialog({ open: true, report })}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleExportReportExpenses(report, 'excel')}>
                              <FileSpreadsheet className="h-4 w-4 mr-2" />
                              Download Excel
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportReportExpenses(report, 'pdf')}>
                              <FileText className="h-4 w-4 mr-2" />
                              Download PDF
                            </DropdownMenuItem>
                            {report.status === 'submitted' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => setPayDialog({ open: true, report })}
                                  className="text-green-600"
                                >
                                  <DollarSign className="h-4 w-4 mr-2" />
                                  Mark as Paid
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* View Dialog */}
      <Dialog open={viewDialog.open} onOpenChange={(open) => setViewDialog({ open, report: null })}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewDialog.report?.title}</DialogTitle>
          </DialogHeader>
          {viewDialog.report && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Employee</p>
                  <p className="font-medium">{getUserName(viewDialog.report.employeeId)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <StatusBadge status={viewDialog.report.status} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Period</p>
                  <p className="font-medium">
                    {viewDialog.report.periodStart && viewDialog.report.periodEnd
                      ? `${format(new Date(viewDialog.report.periodStart), 'PPP')} - ${format(new Date(viewDialog.report.periodEnd), 'PPP')}`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="font-medium text-lg">
                    {formatCurrency(viewDialog.report.totalAmount, baseCurrency)}
                  </p>
                </div>
              </div>
              
              {viewDialog.report.notes && (
                <div>
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="font-medium">{viewDialog.report.notes}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-500 mb-2">Expenses in this report</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {getReportExpenses(viewDialog.report.id).map(expense => (
                    <div key={expense.id} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="font-medium">{expense.merchant}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span>{expense.date && format(new Date(expense.date), 'MMM d, yyyy')}</span>
                          <CategoryBadge category={expense.category} label={getCategoryLabel(expense.category)} />
                        </div>
                      </div>
                      <p className="font-medium">
                        {formatCurrency(expense.amount, expense.currency || baseCurrency)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pay Dialog */}
      <Dialog open={payDialog.open} onOpenChange={(open) => setPayDialog({ open, report: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Mark Report as Paid
            </DialogTitle>
            <DialogDescription>
              This will mark the report "{payDialog.report?.title}" as paid and set all 
              {' '}{getReportExpenses(payDialog.report?.id).length} linked expenses to reimbursed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Amount</span>
                <span className="text-xl font-bold text-gray-900">
                  {formatCurrency(payDialog.report?.totalAmount, baseCurrency)}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setPayDialog({ open: false, report: null })}
              className="w-full sm:w-[180px] h-10 rounded-md font-medium"
            >
              Cancel
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700 w-full sm:w-[180px] h-10 rounded-md font-medium"
              onClick={() => payDialog.report && markAsPaidMutation.mutate(payDialog.report)}
              disabled={markAsPaidMutation.isPending}
            >
              {markAsPaidMutation.isPending ? 'Processing...' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}