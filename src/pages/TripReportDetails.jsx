import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Plane, Calendar, Users, MapPin, Plus, Pencil, Trash2, Send, Save, ArrowLeft, Receipt
} from 'lucide-react';
import { getCategoryLabel, formatCurrency } from '@/components/shared/CategoryHelpers';
import { StatusBadge } from '@/components/shared/UIHelpers';

export default function TripReportDetails() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const reportId = urlParams.get('id');

  const [deleteExpenseId, setDeleteExpenseId] = useState(null);

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

  // Recalculate total whenever expenses change
  const totalAmount = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  const updateReportMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Report.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', reportId] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
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
    if (report && report.totalAmount !== totalAmount) {
      updateReportMutation.mutate({ id: reportId, data: { totalAmount } });
    }
  }, [totalAmount, report?.totalAmount]);

  const handleAddExpense = () => {
    navigate(createPageUrl(`NewExpense?reportId=${reportId}`));
  };

  const handleEditExpense = (expenseId) => {
    navigate(createPageUrl(`EditExpense?id=${expenseId}`));
  };

  const handleSaveDraft = () => {
    updateReportMutation.mutate({ id: reportId, data: { status: 'open', totalAmount } });
  };

  const handleSubmitReport = () => {
    submitReportMutation.mutate();
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

        {isEditable && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSaveDraft} disabled={updateReportMutation.isPending}>
              <Save className="h-4 w-4 mr-2" /> Save as Draft
            </Button>
            <Button 
              onClick={handleSubmitReport} 
              disabled={submitReportMutation.isPending || expenses.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Send className="h-4 w-4 mr-2" /> Submit Report
            </Button>
          </div>
        )}
      </div>

      {/* Trip Info Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
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
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-indigo-600" />
            Expenses
          </CardTitle>
          {isEditable && (
            <Button onClick={handleAddExpense} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Plus className="h-4 w-4 mr-2" /> Add Expense
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
                <Button onClick={handleAddExpense} variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-2" /> Add Your First Expense
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  {isEditable && <TableHead className="text-right">Actions</TableHead>}
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
                    {isEditable && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {expense.status === 'draft' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleEditExpense(expense.id)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setDeleteExpenseId(expense.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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