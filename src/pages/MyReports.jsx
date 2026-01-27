import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '../utils';
import { format } from 'date-fns';
import {
  Plus,
  Search,
  Eye,
  MoreHorizontal,
  FileText,
  FileSpreadsheet,
  Trash2,
  Send,
  Pencil,
  MapPin,
  Users
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
import { formatCurrency, getCategoryLabel } from '../components/shared/CategoryHelpers';
import {
  exportToExcel,
  exportToPDF,
  prepareReportDataForExport,
  prepareExpenseDataForExport,
  generateExportFilename
} from '../components/shared/ExportUtils';
import { logAuditEvent } from '../components/shared/AuditLogger';
import { StatusBadge, CategoryBadge, ExportButtonGroup, PageHeader, EmptyState, LoadingSpinner } from '../components/shared/UIHelpers';

export default function MyReports() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const initialStatus = urlParams.get('status') || 'all';
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);
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

  const baseCurrency = 'USD';

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
    
    if (type === 'excel') {
      exportToExcel(data, filename);
    } else if (type === 'pdf') {
      exportToPDF(data, 'My Reports', filename);
    }
  };

  const handleExportReportExpenses = (report, type) => {
    const expenses = getReportExpenses(report.id);
    const data = prepareExpenseDataForExport(expenses, report.tripCurrency);
    const filename = `Expensia_Report_${report.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}`;
    
    if (type === 'excel') {
      exportToExcel(data, `${filename}.xlsx`);
    } else if (type === 'pdf') {
      exportToPDF(data, `${filename}.pdf`, { ...report, tripCurrency: report.tripCurrency });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <PageHeader title="My Reports" subtitle={`${filteredReports.length} reports`}>
        <Link to={createPageUrl('CreateTripReport')}>
          <Button className="bg-indigo-600 hover:bg-indigo-700 rounded-md font-medium h-10 px-6 w-full sm:w-[180px]">
            <Plus className="h-4 w-4 mr-2" />
            Create Trip Report
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
      <Card className="border-0 shadow-sm overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="bg-gray-50 border-b border-gray-200">
                <TableHead className="font-semibold text-gray-700">Trip Name</TableHead>
                <TableHead className="font-semibold text-gray-700">Trip Dates</TableHead>
                <TableHead className="font-semibold text-gray-700">Destination</TableHead>
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
                      description="Create your first trip report"
                      action={
                        <Link to={createPageUrl('CreateTripReport')}>
                          <Button variant="link" className="text-indigo-600">Create your first trip report</Button>
                        </Link>
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredReports.map((report, index) => {
                  const reportExpenses = getReportExpenses(report.id);
                  return (
                    <TableRow key={report.id} className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <TableCell className="font-medium text-sm">
                        <Link 
                          to={createPageUrl(`TripReportDetails?id=${report.id}`)}
                          className="text-indigo-600 hover:underline"
                        >
                          {report.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {report.tripStartDate && report.tripEndDate ? (
                          <span className="text-sm text-gray-600">
                            {format(new Date(report.tripStartDate), 'MMM d')} - {format(new Date(report.tripEndDate), 'MMM d, yyyy')}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {report.destination || '-'}
                      </TableCell>
                      <TableCell className="text-sm">{reportExpenses.length}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-sm">
                        {formatCurrency(report.totalAmount, report.tripCurrency || 'USD')}
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
                            <DropdownMenuItem asChild>
                              <Link to={createPageUrl(`TripReportDetails?id=${report.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Link>
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
                            <>
                              {report.status === 'open' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => submitMutation.mutate(report)}>
                                    <Send className="h-4 w-4 mr-2" />
                                    Submit Report
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => setDeleteDialog({ open: true, report })}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </>
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
                  <p className="text-sm text-gray-500">Trip Dates</p>
                  <p className="font-medium">
                    {viewDialog.report.tripStartDate && viewDialog.report.tripEndDate
                      ? `${format(new Date(viewDialog.report.tripStartDate), 'PPP')} - ${format(new Date(viewDialog.report.tripEndDate), 'PPP')}`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <StatusBadge status={viewDialog.report.status} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Destination</p>
                  <p className="font-medium flex items-center gap-1">
                    {viewDialog.report.destination ? (
                      <><MapPin className="h-4 w-4 text-gray-400" /> {viewDialog.report.destination}</>
                    ) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Travelers</p>
                  <p className="font-medium flex items-center gap-1">
                    <Users className="h-4 w-4 text-gray-400" /> {viewDialog.report.travelerCount || 1}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="font-medium text-lg">
                    {formatCurrency(viewDialog.report.totalAmount, viewDialog.report.tripCurrency || 'USD')}
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
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialog({ open: false, report: null })}
              className="w-full sm:w-[140px] h-10 rounded-md font-medium"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteDialog.report && deleteMutation.mutate(deleteDialog.report.id)}
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