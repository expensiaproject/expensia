import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '../utils';
import { format } from 'date-fns';
import {
  Plus,
  Search,
  Download,
  Eye,
  MoreHorizontal,
  FileText,
  Trash2,
  Send
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
import { getStatusColor, formatCurrency, getCategoryLabel, getCategoryColor } from '../components/shared/CategoryHelpers';
import {
  exportToCSV,
  exportToExcel,
  exportToPDF,
  prepareReportDataForExport,
  prepareExpenseDataForExport,
  generateExportFilename
} from '../components/shared/ExportUtils';
import { logAuditEvent } from '../components/shared/AuditLogger';

export default function MyReports() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewDialog, setViewDialog] = useState({ open: false, report: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, report: null });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['myReports', user?.id],
    queryFn: () => base44.entities.Report.filter({ employeeId: user?.id }, '-created_date', 100),
    enabled: !!user?.id,
  });

  const { data: allExpenses = [] } = useQuery({
    queryKey: ['myExpenses', user?.id],
    queryFn: () => base44.entities.Expense.filter({ employeeId: user?.id }, '-date', 500),
    enabled: !!user?.id,
  });

  const baseCurrency = user?.baseCurrency || 'USD';

  const submitMutation = useMutation({
    mutationFn: async (report) => {
      await base44.entities.Report.update(report.id, { status: 'submitted' });
      await logAuditEvent(user, 'report', report.id, 'submit', { from: 'open', to: 'submitted' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myReports'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (reportId) => {
      // First, unlink expenses from this report
      const linkedExpenses = allExpenses.filter(e => e.reportId === reportId);
      for (const exp of linkedExpenses) {
        await base44.entities.Expense.update(exp.id, { reportId: null });
      }
      await base44.entities.Report.delete(reportId);
      await logAuditEvent(user, 'report', reportId, 'delete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myReports'] });
      queryClient.invalidateQueries({ queryKey: ['myExpenses'] });
      setDeleteDialog({ open: false, report: null });
    },
  });

  const filteredReports = reports.filter(rep => {
    const matchesSearch = !search || rep.title?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || rep.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getReportExpenses = (reportId) => {
    return allExpenses.filter(e => e.reportId === reportId);
  };

  const handleExport = (type) => {
    const data = prepareReportDataForExport(filteredReports);
    const filename = generateExportFilename(type, false).replace('Export', 'Reports');
    
    switch (type) {
      case 'csv':
        exportToCSV(data, filename);
        break;
      case 'excel':
        exportToExcel(data, filename);
        break;
      case 'pdf':
        exportToPDF(data, 'My Reports', filename);
        break;
    }
  };

  const handleExportReportExpenses = (report, type) => {
    const expenses = getReportExpenses(report.id);
    const data = prepareExpenseDataForExport(expenses);
    const filename = `Expensia_Report_${report.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}`;
    
    switch (type) {
      case 'csv':
        exportToCSV(data, `${filename}.csv`);
        break;
      case 'excel':
        exportToExcel(data, `${filename}.xlsx`);
        break;
      case 'pdf':
        exportToPDF(data, `Report: ${report.title}`, `${filename}.pdf`);
        break;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">My Reports</h1>
          <p className="text-gray-500 mt-1">{filteredReports.length} reports</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={createPageUrl('NewReport')}>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="h-4 w-4 mr-2" />
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
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Title</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Expenses</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No reports found</p>
                    <Link to={createPageUrl('NewReport')}>
                      <Button variant="link" className="mt-2">Create your first report</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ) : (
                filteredReports.map((report) => {
                  const reportExpenses = getReportExpenses(report.id);
                  return (
                    <TableRow key={report.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{report.title}</TableCell>
                      <TableCell>
                        {report.periodStart && report.periodEnd ? (
                          <span className="text-sm">
                            {format(new Date(report.periodStart), 'MMM d')} - {format(new Date(report.periodEnd), 'MMM d, yyyy')}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{reportExpenses.length} expenses</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(report.totalAmountBase, baseCurrency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={getStatusColor(report.status)}>
                          {report.status}
                        </Badge>
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
                            <DropdownMenuItem onClick={() => handleExportReportExpenses(report, 'csv')}>
                              <Download className="h-4 w-4 mr-2" />
                              Export CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportReportExpenses(report, 'excel')}>
                              <Download className="h-4 w-4 mr-2" />
                              Export Excel
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportReportExpenses(report, 'pdf')}>
                              <Download className="h-4 w-4 mr-2" />
                              Export PDF
                            </DropdownMenuItem>
                            {report.status === 'open' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => submitMutation.mutate(report)}>
                                  <Send className="h-4 w-4 mr-2" />
                                  Submit Report
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link to={`${createPageUrl('EditReport')}?id=${report.id}`}>
                                    <FileText className="h-4 w-4 mr-2" />
                                    Edit
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-red-600"
                                  onClick={() => setDeleteDialog({ open: true, report })}
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
                  <p className="text-sm text-gray-500">Period</p>
                  <p className="font-medium">
                    {viewDialog.report.periodStart && viewDialog.report.periodEnd
                      ? `${format(new Date(viewDialog.report.periodStart), 'PPP')} - ${format(new Date(viewDialog.report.periodEnd), 'PPP')}`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <Badge className={getStatusColor(viewDialog.report.status)}>
                    {viewDialog.report.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="font-medium text-lg">
                    {formatCurrency(viewDialog.report.totalAmountBase, baseCurrency)}
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
                          <Badge variant="outline" className={getCategoryColor(expense.category)}>
                            {getCategoryLabel(expense.category)}
                          </Badge>
                        </div>
                      </div>
                      <p className="font-medium">
                        {formatCurrency(expense.amountInBase, baseCurrency)}
                      </p>
                    </div>
                  ))}
                  {getReportExpenses(viewDialog.report.id).length === 0 && (
                    <p className="text-gray-500 text-center py-4">No expenses linked to this report</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, report: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Report</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this report? The expenses will be unlinked but not deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, report: null })}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteDialog.report && deleteMutation.mutate(deleteDialog.report.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}