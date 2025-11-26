import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '../utils';
import { format, subDays } from 'date-fns';
import {
  ArrowLeft,
  Loader2,
  CheckSquare,
  Square,
  Receipt,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { getCategoryLabel, getCategoryColor, formatCurrency } from '../components/shared/CategoryHelpers';
import { logAuditEvent } from '../components/shared/AuditLogger';

export default function NewReport() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['mySubmittedExpenses', user?.id],
    queryFn: () => base44.entities.Expense.filter({ employeeId: user?.id, status: 'submitted' }, '-date', 200),
    enabled: !!user?.id,
  });

  const [form, setForm] = useState({
    title: '',
    periodStart: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    periodEnd: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });

  const [selectedExpenseIds, setSelectedExpenseIds] = useState([]);
  const [errors, setErrors] = useState({});

  const baseCurrency = 'USD';

  // Filter expenses that don't already belong to a report
  const availableExpenses = expenses.filter(e => !e.reportId);

  const selectedExpenses = availableExpenses.filter(e => selectedExpenseIds.includes(e.id));
  const totalAmount = selectedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const toggleExpense = (expenseId) => {
    setSelectedExpenseIds(prev => 
      prev.includes(expenseId) 
        ? prev.filter(id => id !== expenseId)
        : [...prev, expenseId]
    );
  };

  const selectAll = () => {
    if (selectedExpenseIds.length === availableExpenses.length) {
      setSelectedExpenseIds([]);
    } else {
      setSelectedExpenseIds(availableExpenses.map(e => e.id));
    }
  };

  const createReportMutation = useMutation({
    mutationFn: async (reportData) => {
      const result = await base44.entities.Report.create(reportData);
      
      // Link selected expenses to this report
      for (const expenseId of selectedExpenseIds) {
        await base44.entities.Expense.update(expenseId, { reportId: result.id });
      }
      
      await logAuditEvent(user, 'report', result.id, 'create', null, { expenseCount: selectedExpenseIds.length });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myReports'] });
      queryClient.invalidateQueries({ queryKey: ['myExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['mySubmittedExpenses'] });
      navigate(createPageUrl('MyReports'));
    },
  });

  const handleSubmit = async (e, submitReport = false) => {
    e.preventDefault();
    
    const newErrors = {};
    if (!form.title) newErrors.title = 'Title is required';
    if (selectedExpenseIds.length === 0) newErrors.expenses = 'Select at least one expense';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    const reportData = {
      title: form.title,
      employeeId: user.id,
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
      totalAmount: totalAmount,
      status: submitReport ? 'submitted' : 'open',
      notes: form.notes,
    };
    
    createReportMutation.mutate(reportData);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Expense Report</h1>
          <p className="text-gray-500">Group your submitted expenses into a report</p>
        </div>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        {/* Report Details */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Report Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Report Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Tokyo Business Trip - March 2024"
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                className={errors.title ? 'border-red-500' : ''}
              />
              {errors.title && <p className="text-sm text-red-500 mt-1">{errors.title}</p>}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="periodStart">Period Start</Label>
                <Input
                  id="periodStart"
                  type="date"
                  value={form.periodStart}
                  onChange={(e) => setForm(f => ({ ...f, periodStart: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="periodEnd">Period End</Label>
                <Input
                  id="periodEnd"
                  type="date"
                  value={form.periodEnd}
                  onChange={(e) => setForm(f => ({ ...f, periodEnd: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add any additional notes..."
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Expense Selection */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Select Expenses</CardTitle>
            {availableExpenses.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                {selectedExpenseIds.length === availableExpenses.length ? 'Deselect All' : 'Select All'}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {expensesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-200 border-t-indigo-600" />
              </div>
            ) : availableExpenses.length === 0 ? (
              <div className="text-center py-8">
                <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No submitted expenses available</p>
                <p className="text-sm text-gray-400 mt-1">
                  Submit your draft expenses first, or they may already be in another report
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {availableExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedExpenseIds.includes(expense.id)
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-100 hover:border-gray-200 bg-white'
                    }`}
                    onClick={() => toggleExpense(expense.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox 
                        checked={selectedExpenseIds.includes(expense.id)}
                        onCheckedChange={() => toggleExpense(expense.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{expense.merchant}</p>
                          <Badge variant="outline" className={getCategoryColor(expense.category)}>
                            {getCategoryLabel(expense.category)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                          <Calendar className="h-3 w-3" />
                          {expense.date && format(new Date(expense.date), 'MMM d, yyyy')}
                          {expense.description && (
                            <span className="truncate">• {expense.description}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(expense.amount, expense.currency || baseCurrency)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {errors.expenses && <p className="text-sm text-red-500 mt-2">{errors.expenses}</p>}
          </CardContent>
        </Card>

        {/* Summary */}
        <Card className="border-0 shadow-sm bg-gradient-to-r from-indigo-50 to-purple-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Selected Expenses</p>
                <p className="text-2xl font-bold text-gray-900">{selectedExpenseIds.length}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {formatCurrency(totalAmount, baseCurrency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="outline"
            disabled={createReportMutation.isPending}
          >
            Save as Open
          </Button>
          <Button 
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            className="bg-indigo-600 hover:bg-indigo-700"
            disabled={createReportMutation.isPending}
          >
            {createReportMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Save & Submit
          </Button>
        </div>
      </form>
    </div>
  );
}