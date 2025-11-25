import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, FileText } from 'lucide-react';

// Status Badge Component with consistent styling
export function StatusBadge({ status }) {
  const statusStyles = {
    draft: 'bg-gray-100 text-gray-700 border-gray-200',
    submitted: 'bg-blue-100 text-blue-700 border-blue-200',
    reimbursed: 'bg-green-100 text-green-700 border-green-200',
    paid: 'bg-green-100 text-green-700 border-green-200',
    open: 'bg-gray-100 text-gray-600 border-gray-200',
    flagged: 'bg-orange-100 text-orange-700 border-orange-200',
  };

  return (
    <Badge 
      variant="secondary" 
      className={`${statusStyles[status] || statusStyles.draft} px-2.5 py-0.5 text-xs font-medium capitalize rounded-full border`}
    >
      {status}
    </Badge>
  );
}

// Category Badge Component
export function CategoryBadge({ category, label }) {
  const categoryStyles = {
    air_tickets: 'bg-blue-50 text-blue-700 border-blue-200',
    local_transport: 'bg-green-50 text-green-700 border-green-200',
    overseas_transport: 'bg-teal-50 text-teal-700 border-teal-200',
    trip_insurance: 'bg-purple-50 text-purple-700 border-purple-200',
    communication: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    entertainment_hospitality: 'bg-pink-50 text-pink-700 border-pink-200',
    equipment_tools: 'bg-orange-50 text-orange-700 border-orange-200',
    gifts_souvenirs: 'bg-rose-50 text-rose-700 border-rose-200',
    other_business: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    miscellaneous: 'bg-gray-50 text-gray-700 border-gray-200',
  };

  return (
    <Badge 
      variant="secondary" 
      className={`${categoryStyles[category] || categoryStyles.miscellaneous} px-2 py-0.5 text-xs font-medium rounded-md border`}
    >
      {label}
    </Badge>
  );
}

// Export Button Group Component for Users
export function ExportButtonGroup({ onExport, disabled = false }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onExport('excel')}
        disabled={disabled}
        className="h-9 px-4 rounded-md font-medium min-w-[140px]"
      >
        <FileSpreadsheet className="h-4 w-4 mr-2" />
        Download Excel
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onExport('pdf')}
        disabled={disabled}
        className="h-9 px-4 rounded-md font-medium min-w-[140px]"
      >
        <FileText className="h-4 w-4 mr-2" />
        Download PDF
      </Button>
    </div>
  );
}

// Export Button Group Component for Admins
export function AdminExportButtonGroup({ onExport, disabled = false }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onExport('excel')}
        disabled={disabled}
        className="h-9 px-4 rounded-md font-medium min-w-[130px]"
      >
        <FileSpreadsheet className="h-4 w-4 mr-2" />
        Export Excel
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onExport('pdf')}
        disabled={disabled}
        className="h-9 px-4 rounded-md font-medium min-w-[130px]"
      >
        <FileText className="h-4 w-4 mr-2" />
        Export PDF
      </Button>
    </div>
  );
}

// Form Section Component
export function FormSection({ icon: Icon, title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-indigo-600" />}
          {title}
        </h3>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

// Page Header Component
export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {children && (
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {children}
        </div>
      )}
    </div>
  );
}

// Primary Button Component
export function PrimaryButton({ children, className = '', ...props }) {
  return (
    <Button 
      className={`bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md px-6 py-2.5 h-10 
                  w-full sm:w-[220px] ${className}`}
      {...props}
    >
      {children}
    </Button>
  );
}

// Secondary Button Component
export function SecondaryButton({ children, className = '', ...props }) {
  return (
    <Button 
      variant="outline"
      className={`font-medium rounded-md px-5 py-2.5 h-10 
                  w-full sm:w-[180px] ${className}`}
      {...props}
    >
      {children}
    </Button>
  );
}

// Empty State Component
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="text-center py-12 px-6">
      {Icon && (
        <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Icon className="h-8 w-8 text-gray-400" />
        </div>
      )}
      <h3 className="text-base font-medium text-gray-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
      {action}
    </div>
  );
}

// Loading Spinner Component
export function LoadingSpinner({ size = 'md' }) {
  const sizes = {
    sm: 'h-6 w-6 border-2',
    md: 'h-8 w-8 border-4',
    lg: 'h-12 w-12 border-4',
  };

  return (
    <div className="flex items-center justify-center py-12">
      <div className={`animate-spin rounded-full ${sizes[size]} border-indigo-200 border-t-indigo-600`} />
    </div>
  );
}

export default {
  StatusBadge,
  CategoryBadge,
  ExportButtonGroup,
  AdminExportButtonGroup,
  FormSection,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  EmptyState,
  LoadingSpinner,
};