import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ArrowRight, Receipt } from 'lucide-react';
import { createPageUrl } from '../../utils';
import { getCategoryLabel, getCategoryColor, getStatusColor, formatCurrency } from '../shared/CategoryHelpers';

export default function RecentExpenses({ expenses, baseCurrency = 'USD', showViewAll = true }) {
  const recentExpenses = expenses.slice(0, 5);

  return (
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">Recent Expenses</CardTitle>
        {showViewAll && (
          <Link to={createPageUrl('MyExpenses')}>
            <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700">
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {recentExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <Receipt className="h-12 w-12 mb-3 opacity-50" />
            <p>No expenses yet</p>
            <Link to={createPageUrl('NewExpense')}>
              <Button variant="link" className="mt-2 text-indigo-600">
                Add your first expense
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 truncate">{expense.merchant}</p>
                    <Badge variant="secondary" className={`text-xs ${getStatusColor(expense.status)}`}>
                      {expense.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {expense.date && format(new Date(expense.date), 'MMM d, yyyy')}
                    </span>
                    <Badge variant="outline" className={`text-xs ${getCategoryColor(expense.category)}`}>
                      {getCategoryLabel(expense.category)}
                    </Badge>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(expense.amountInBase, baseCurrency)}
                  </p>
                  {expense.originalCurrency !== baseCurrency && (
                    <p className="text-xs text-gray-500">
                      {formatCurrency(expense.originalAmount, expense.originalCurrency)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}