import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Plane, Calendar, Users, MapPin, Plus, Pencil, Trash2, Send, Save, ArrowLeft, 
  Receipt, Eye, RotateCcw, X
} from 'lucide-react';
import { getCategoryLabel, formatCurrency } from '@/components/shared/CategoryHelpers';
import { StatusBadge } from '@/components/shared/UIHelpers';
import ExpenseFormModal from '@/components/expenses/ExpenseFormModal';
import ExpenseViewModal from '@/components/expenses/ExpenseViewModal';

export default function TripReportDetails() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const reportId = urlParams.get('id');
  const pendingReceiptUrlsParam = urlParams.get('receiptUrls');
  const pendingReceiptUrls = pendingReceiptUrlsParam ? JSON.parse(decodeURIComponent(pendingReceiptUrlsParam)) : [];
  const [currentReceiptIndex, setCurrentReceiptIndex] = useState(0);

  const [deleteExpenseId, setDeleteExpenseId] = useState(null);
  const [isEditingTrip, setIsEditingTrip] = useState(false);
  const [tripForm, setTripForm] = useState({});
  const [expenseModal, setExpenseModal] = useState({ open: false, expense: null });
  const [viewExpense, setViewExpense] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ['report', reportId],
    queryFn: () => base44.entities.Report.filter({ id: reportId }),
    enabled: !!reportId,
    select: (data) => data?.[0],
  });

  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', 'report', reportId],
    queryFn: () => base44.entities.Expense.filter({ reportId }),
    enabled: !!reportId,
  });

  // Initialize trip form when report loads
  useEffect(() => {
    if (report) {
      setTripForm({
        title: report.title || '',
        tripStartDate: report.tripStartDate || '',
        tripEndDate: report.tripEndDate || '',
        travelerCount: report.travelerCount || 1,
        destination: report.destination || '',
        notes: report.notes || '',
      });
    }
  }, [report]);

  // Auto-open expense modal if there are pending receipt URLs
  useEffect(() => {
    if (pendingReceiptUrls.length > 0 && report && currentReceiptIndex < pendingReceiptUrls.length) {
      setExpenseModal({ open: true, expense: null, initialReceiptUrl: pendingReceiptUrls[currentReceiptIndex] });
    }
  }, [report, currentReceiptIndex]);

  // Calculate totals
  const totalAmount = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const perTraveler = report?.travelerCount > 1 ? totalAmount / report.travelerCount : null;

  const updateReportMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Report.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', reportId] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setIsEditingTrip(false);
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id) => base44.entities.Expense.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', 'report', reportId] });
      setDeleteExpenseId(null);
    },
  });

  const submitReportMutation = useMutation({
    mutationFn: async () => {
      // Update all draft expenses to submitted
      for (const exp of expenses) {
        if (exp.status === 'draft') {
          await base44.entities.Expense.update(exp.id, { status: 'submitted' });
        }
      }
      // Update report status
      await base44.entities.Report.update(reportId, { 
        status: 'submitted',
        totalAmount 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', reportId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', 'report', reportId] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  // Update report totalAmount when expenses change
  useEffect(() => {
    if (report && report.totalAmount !== totalAmount && !reportLoading) {
      updateReportMutation.mutate({ id: reportId, data: { totalAmount } });
    }
  }, [totalAmount]);

  const handleSaveTripInfo = () => {
    updateReportMutation.mutate({ 
      id: reportId, 
      data: { 
        ...tripForm,
        travelerCount: parseInt(tripForm.travelerCount) || 1,
        totalAmount 
      } 
    });
  };

  const handleSaveDraft = () => {
    updateReportMutation.mutate({ id: reportId, data: { status: 'open', totalAmount } });
  };

  const handleSubmitReport = () => {
    submitReportMutation.mutate();
  };

  const handleCancelReport = () => {
    navigate(createPageUrl('MyReports'));
  };

  if (reportLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Report not found</p>
        <Link to={createPageUrl('MyReports')}>
          <Button variant="outline" className="mt-4">Back to Reports</Button>
        </Link>
      </div>
    );
  }

  const isEditable = report.status === 'open';

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link to={createPageUrl('MyReports')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{report.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={report.status} />
              {report.destination && (
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {report.destination}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Trip Info Section - Editable */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Plane className="h-5 w-5 text-indigo-600" />
            Trip Information
          </CardTitle>
          {isEditable && !isEditingTrip && (
            <Button variant="ghost" size="sm" onClick={() => setIsEditingTrip(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isEditingTrip ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Trip Name *</Label>
                  <Input
                    value={tripForm.title}
                    onChange={(e) => setTripForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g., Tokyo Business Trip"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Destination</Label>
                  <Input
                    value={tripForm.destination}
                    onChange={(e) => setTripForm(f => ({ ...f, destination: e.target.value }))}
                    placeholder="e.g., Tokyo, Japan"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Start Date</Label>
                  <Input
                    type="date"
                    value={tripForm.tripStartDate}
                    onChange={(e) => setTripForm(f => ({ ...f, tripStartDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">End Date</Label>
                  <Input
                    type="date"
                    value={tripForm.tripEndDate}
                    onChange={(e) => setTripForm(f => ({ ...f, tripEndDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Number of Travelers</Label>
                  <Input
                    type="number"
                    min="1"
                    value={tripForm.travelerCount}
                    onChange={(e) => setTripForm(f => ({ ...f, travelerCount: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Trip Description (Optional)</Label>
                <Textarea
                  value={tripForm.notes}
                  onChange={(e) => setTripForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Add any notes about this trip..."
                  rows={2}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setIsEditingTrip(false)}>
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSaveTripInfo}
                  disabled={updateReportMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Trip Dates</p>
                  <p className="text-sm font-medium">
                    {report.tripStartDate ? format(new Date(report.tripStartDate), 'MMM d') : '-'} - {report.tripEndDate ? format(new Date(report.tripEndDate), 'MMM d, yyyy') : '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Travelers</p>
                  <p className="text-sm font-medium">{report.travelerCount || 1}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Expenses</p>
                  <p className="text-sm font-medium">{expenses.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 flex items-center justify-center text-gray-400 font-bold">$</div>
                <div>
                  <p className="text-xs text-gray-500">Total Amount</p>
                  <p className="text-sm font-semibold text-indigo-600">{formatCurrency(totalAmount, 'USD')}</p>
                </div>
              </div>
            </div>
          )}
          {report.notes && !isEditingTrip && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Trip Notes</p>
              <p className="text-sm text-gray-700">{report.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Summary */}
      <Card className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 border-0">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-indigo-600">{expenses.length}</p>
              <p className="text-xs text-gray-600">Total Expenses</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-indigo-600">{formatCurrency(totalAmount, 'USD')}</p>
              <p className="text-xs text-gray-600">Total Amount</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-indigo-600">{report.travelerCount || 1}</p>
              <p className="text-xs text-gray-600">Travelers</p>
            </div>
            {perTraveler && (
              <div>
                <p className="text-2xl font-bold text-indigo-600">{formatCurrency(perTraveler, 'USD')}</p>
                <p className="text-xs text-gray-600">Per Traveler</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-indigo-600" />
            Expenses
          </CardTitle>
          {isEditable && (
            <Button 
              onClick={() => setExpenseModal({ open: true, expense: null })} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Expense to This Trip
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {expensesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-200 border-t-indigo-600" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No expenses yet</p>
              {isEditable && (
                <Button 
                  onClick={() => setExpenseModal({ open: true, expense: null })} 
                  variant="outline" 
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Your First Expense
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{expense.date ? format(new Date(expense.date), 'MMM d, yyyy') : '-'}</TableCell>
                      <TableCell className="font-medium">{expense.merchant}</TableCell>
                      <TableCell>{getCategoryLabel(expense.category)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(expense.amount, expense.currency || 'USD')}
                      </TableCell>
                      <TableCell><StatusBadge status={expense.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setViewExpense(expense)}
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {isEditable && expense.status === 'draft' && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setExpenseModal({ open: true, expense })}
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {expense.receiptUrl && (
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => setExpenseModal({ open: true, expense })}
                                  title="Re-run OCR"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                          {isEditable && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => setDeleteExpenseId(expense.id)}
                              className="text-red-600 hover:text-red-700"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <Button variant="outline" onClick={handleCancelReport}>
          <X className="h-4 w-4 mr-2" /> Cancel
        </Button>
        {isEditable && (
          <>
            <Button variant="outline" onClick={handleSaveDraft} disabled={updateReportMutation.isPending}>
              <Save className="h-4 w-4 mr-2" /> Save as Draft
            </Button>
            <Button 
              onClick={handleSubmitReport} 
              disabled={submitReportMutation.isPending || expenses.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Send className="h-4 w-4 mr-2" /> Save & Submit
            </Button>
          </>
        )}
      </div>

      {/* Expense Form Modal */}
      <ExpenseFormModal
        open={expenseModal.open}
        onClose={() => {
          setExpenseModal({ open: false, expense: null });
          // If there are more receipts to process, move to next
          if (pendingReceiptUrls.length > 0 && currentReceiptIndex < pendingReceiptUrls.length - 1) {
            setCurrentReceiptIndex(prev => prev + 1);
          } else if (pendingReceiptUrls.length > 0) {
            // All receipts processed, clear URL
            window.history.replaceState({}, '', createPageUrl(`TripReportDetails?id=${reportId}`));
          }
        }}
        reportId={reportId}
        expense={expenseModal.expense}
        initialReceiptUrl={expenseModal.initialReceiptUrl}
        onSuccess={() => {
          // Move to next receipt after saving
          if (pendingReceiptUrls.length > 0 && currentReceiptIndex < pendingReceiptUrls.length - 1) {
            setCurrentReceiptIndex(prev => prev + 1);
          } else if (pendingReceiptUrls.length > 0) {
            // All receipts processed, clear URL
            window.history.replaceState({}, '', createPageUrl(`TripReportDetails?id=${reportId}`));
          }
        }}
      />

      {/* Expense View Modal */}
      <ExpenseViewModal
        open={!!viewExpense}
        onClose={() => setViewExpense(null)}
        expense={viewExpense}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteExpenseId} onOpenChange={() => setDeleteExpenseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteExpenseMutation.mutate(deleteExpenseId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}