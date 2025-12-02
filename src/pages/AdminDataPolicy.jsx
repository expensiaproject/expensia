import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Database,
  Save,
  Clock,
  AlertTriangle,
  Download,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { logAuditEvent } from '../components/shared/AuditLogger';

export default function AdminDataPolicy() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    retentionPeriodYears: 5,
    lastReviewDate: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ['dataPolicy'],
    queryFn: () => base44.entities.DataPolicy.list(),
  });

  const policy = policies[0];

  useEffect(() => {
    if (policy) {
      setForm({
        retentionPeriodYears: policy.retentionPeriodYears || 5,
        lastReviewDate: policy.lastReviewDate || '',
        notes: policy.notes || ''
      });
    }
  }, [policy]);

  const savePolicyMutation = useMutation({
    mutationFn: async (data) => {
      if (policy) {
        await base44.entities.DataPolicy.update(policy.id, data);
        await logAuditEvent(user, 'data_policy', policy.id, 'update', data);
      } else {
        const result = await base44.entities.DataPolicy.create(data);
        await logAuditEvent(user, 'data_policy', result.id, 'create', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataPolicy'] });
    },
  });

  const handleSave = (e) => {
    e.preventDefault();
    savePolicyMutation.mutate({
      retentionPeriodYears: parseInt(form.retentionPeriodYears),
      lastReviewDate: form.lastReviewDate || format(new Date(), 'yyyy-MM-dd'),
      notes: form.notes
    });
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Access denied. Admin only.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Data Retention Settings</h1>
        <p className="text-gray-500 mt-1">Manage data retention policy and compliance settings</p>
      </div>

      {/* Retention Policy */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-indigo-600" />
            Retention Policy
          </CardTitle>
          <CardDescription>
            Configure how long expense data is retained in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="retentionPeriodYears">Retention Period (Years)</Label>
                <Input
                  id="retentionPeriodYears"
                  type="number"
                  min="1"
                  max="10"
                  value={form.retentionPeriodYears}
                  onChange={(e) => setForm(f => ({ ...f, retentionPeriodYears: e.target.value }))}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Data older than this will be eligible for archival/deletion
                </p>
              </div>
              <div>
                <Label htmlFor="lastReviewDate">Last Review Date</Label>
                <Input
                  id="lastReviewDate"
                  type="date"
                  value={form.lastReviewDate}
                  onChange={(e) => setForm(f => ({ ...f, lastReviewDate: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Policy Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Add any notes about data retention policy..."
                rows={3}
              />
            </div>
            <Button 
              type="submit" 
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={savePolicyMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {savePolicyMutation.isPending ? 'Saving...' : 'Save Policy'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Current Policy Status */}
      {policy && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-600" />
              Current Policy Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Retention Period</p>
                <p className="text-2xl font-bold text-gray-900">{policy.retentionPeriodYears} years</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Last Reviewed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {policy.lastReviewDate 
                    ? format(new Date(policy.lastReviewDate), 'MMM d, yyyy')
                    : 'Never'}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Data Cutoff Date</p>
                <p className="text-2xl font-bold text-gray-900">
                  {format(
                    new Date(new Date().setFullYear(new Date().getFullYear() - policy.retentionPeriodYears)),
                    'MMM yyyy'
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Management Actions */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>
            Actions for managing user data and compliance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <Download className="h-4 w-4 text-indigo-600" />
                Export All Data
              </h4>
              <p className="text-sm text-gray-500 mt-1">
                Export complete system data for compliance or backup purposes
              </p>
              <Button variant="outline" size="sm" className="mt-3">
                Generate Export
              </Button>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-amber-600" />
                Archive Old Data
              </h4>
              <p className="text-sm text-gray-500 mt-1">
                Archive data older than the retention period
              </p>
              <Button variant="outline" size="sm" className="mt-3">
                Run Archive Process
              </Button>
            </div>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Data management actions are logged for compliance. Ensure you have proper authorization 
              before performing any data operations.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* User Data Requests */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>User Data Rights (GDPR/Privacy)</CardTitle>
          <CardDescription>
            Process user requests for data access or deletion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900">Data Export Request</h4>
              <p className="text-sm text-blue-700 mt-1">
                Users can request a complete export of their personal data from the My Expenses page.
              </p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg">
              <h4 className="font-medium text-amber-900">Data Deletion Request</h4>
              <p className="text-sm text-amber-700 mt-1">
                To process a deletion request, contact support. Minimal records may be retained in audit 
                logs for compliance purposes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}