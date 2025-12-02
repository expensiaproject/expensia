import React from 'react';
import { format } from 'date-fns';
import { Receipt, Calendar, CreditCard, Tag, FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getCategoryLabel, getPaymentMethodLabel, formatCurrency } from '@/components/shared/CategoryHelpers';
import { StatusBadge, CategoryBadge } from '@/components/shared/UIHelpers';

export default function ExpenseViewModal({ open, onClose, expense }) {
  if (!expense) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-indigo-600" />
            Expense Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Receipt Image */}
          {expense.receiptUrl && (
            <div className="rounded-lg overflow-hidden border bg-gray-50">
              {expense.receiptUrl.toLowerCase().includes('.pdf') ? (
                <div className="p-6 text-center">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">PDF Receipt</p>
                  <a 
                    href={expense.receiptUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-indigo-600 text-sm hover:underline flex items-center justify-center gap-1 mt-2"
                  >
                    <ExternalLink className="h-3 w-3" /> View PDF
                  </a>
                </div>
              ) : (
                <img 
                  src={expense.receiptUrl} 
                  alt="Receipt" 
                  className="w-full max-h-48 object-contain"
                />
              )}
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Merchant</p>
              <p className="font-medium">{expense.merchant}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <StatusBadge status={expense.status} />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Date</p>
              <p className="font-medium flex items-center gap-1">
                <Calendar className="h-3 w-3 text-gray-400" />
                {expense.date ? format(new Date(expense.date), 'MMM d, yyyy') : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Category</p>
              <CategoryBadge category={expense.category} label={getCategoryLabel(expense.category)} />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Amount</p>
              <p className="font-semibold text-lg text-indigo-600">
                {formatCurrency(expense.amount, expense.currency || 'USD')}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Payment Method</p>
              <p className="font-medium flex items-center gap-1">
                <CreditCard className="h-3 w-3 text-gray-400" />
                {getPaymentMethodLabel(expense.paymentMethod)}
              </p>
            </div>
            {expense.taxAmount && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Tax Amount</p>
                <p className="font-medium">{formatCurrency(expense.taxAmount, expense.currency || 'USD')}</p>
              </div>
            )}
            {expense.exchangeRate && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Exchange Rate</p>
                <p className="font-medium">{expense.exchangeRate}</p>
              </div>
            )}
          </div>

          {expense.description && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Description</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{expense.description}</p>
            </div>
          )}

          {expense.policyFlags && expense.policyFlags.length > 0 && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs text-amber-700 font-medium mb-1">Policy Warnings</p>
              <ul className="text-sm text-amber-600 list-disc list-inside">
                {expense.policyFlags.map((flag, i) => (
                  <li key={i}>{flag}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}