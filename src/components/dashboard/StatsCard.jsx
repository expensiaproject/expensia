import React from 'react';
import { Card } from '@/components/ui/card';

export default function StatsCard({ title, value, subtitle, icon: Icon, trend, trendUp, color = 'indigo' }) {
  const colorClasses = {
    indigo: 'from-indigo-500 to-indigo-600 shadow-indigo-200',
    green: 'from-emerald-500 to-emerald-600 shadow-emerald-200',
    amber: 'from-amber-500 to-amber-600 shadow-amber-200',
    purple: 'from-purple-500 to-purple-600 shadow-purple-200',
    rose: 'from-rose-500 to-rose-600 shadow-rose-200',
    blue: 'from-blue-500 to-blue-600 shadow-blue-200',
  };

  return (
    <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl lg:text-3xl font-bold text-gray-900 mt-2">{value}</p>
            {subtitle && (
              <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
            )}
            {trend && (
              <div className={`flex items-center gap-1 mt-2 text-sm ${trendUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                <span>{trendUp ? '↑' : '↓'}</span>
                <span>{trend}</span>
              </div>
            )}
          </div>
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[color]} shadow-lg flex items-center justify-center`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${colorClasses[color]}`} />
    </Card>
  );
}