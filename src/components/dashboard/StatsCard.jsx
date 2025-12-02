import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';

export default function StatsCard({ title, value, subtitle, icon: Icon, trend, trendUp, color = 'indigo', href }) {
  const colorClasses = {
    indigo: 'from-indigo-500 to-indigo-600 shadow-indigo-200',
    green: 'from-emerald-500 to-emerald-600 shadow-emerald-200',
    amber: 'from-amber-500 to-amber-600 shadow-amber-200',
    purple: 'from-purple-500 to-purple-600 shadow-purple-200',
    rose: 'from-rose-500 to-rose-600 shadow-rose-200',
    blue: 'from-blue-500 to-blue-600 shadow-blue-200',
  };

  const CardWrapper = ({ children }) => {
    if (href) {
      return (
        <Link to={href} className="block h-full">
          {children}
        </Link>
      );
    }
    return children;
  };

  return (
    <CardWrapper>
      <Card className={`relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-md transition-shadow duration-200 rounded-xl h-full ${href ? 'cursor-pointer' : ''}`}>
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">{title}</p>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mt-1.5 tabular-nums">{value}</p>
              {subtitle && (
                <p className="text-xs text-gray-500 mt-1 truncate">{subtitle}</p>
              )}
              {trend && (
                <div className={`flex items-center gap-1 mt-2 text-xs sm:text-sm ${trendUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                  <span>{trendUp ? '↑' : '↓'}</span>
                  <span>{trend}</span>
                </div>
              )}
            </div>
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${colorClasses[color]} shadow-lg flex items-center justify-center flex-shrink-0`}>
              <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
          </div>
        </div>
        <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${colorClasses[color]}`} />
      </Card>
    </CardWrapper>
  );
}