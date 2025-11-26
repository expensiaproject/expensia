import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { getCategoryLabel } from '../shared/CategoryHelpers';

const COLORS = [
  '#4F46E5', '#7C3AED', '#EC4899', '#F59E0B', '#10B981',
  '#06B6D4', '#8B5CF6', '#F43F5E', '#84CC16', '#6366F1'
];

export default function CategoryChart({ expenses, baseCurrency = 'USD' }) {
  const categoryData = React.useMemo(() => {
    const grouped = {};
    expenses.forEach(exp => {
      const cat = exp.category || 'miscellaneous';
      if (!grouped[cat]) {
        grouped[cat] = 0;
      }
      grouped[cat] += exp.amount || 0;
    });
    
    return Object.entries(grouped)
      .map(([category, amount]) => ({
        name: getCategoryLabel(category),
        value: Math.round(amount * 100) / 100
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  if (categoryData.length === 0) {
    return (
      <Card className="bg-white border-0 shadow-sm rounded-xl h-full">
        <CardHeader className="border-b border-gray-100">
          <CardTitle className="text-lg font-semibold">Spending by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-sm text-gray-400">
            No expense data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-100">
          <p className="font-medium text-gray-900">{payload[0].name}</p>
          <p className="text-indigo-600 font-semibold">
            {baseCurrency} {payload[0].value.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-white border-0 shadow-sm rounded-xl h-full">
      <CardHeader className="border-b border-gray-100">
        <CardTitle className="text-lg font-semibold">Spending by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {categoryData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              layout="horizontal" 
              verticalAlign="bottom"
              formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}