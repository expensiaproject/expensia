import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  Shield,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CATEGORIES, getCategoryLabel, formatCurrency } from '../components/shared/CategoryHelpers';
import { logAuditEvent } from '../components/shared/AuditLogger';

export default function AdminPolicies() {
  const queryClient = useQueryClient();
  const [editDialog, setEditDialog] = useState({ open: false, policy: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, policy: null });
  const [form, setForm] = useState({
    name: '',
    category: '',
    dailyLimitBase: '',
    perTxnLimitBase: '',
    requiresReceipt: true,
    notes: ''
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ['policies'],
    queryFn: () => base44.entities.Policy.list(),
  });

  const baseCurrency = 'USD';

  const createPolicyMutation = useMutation({
    mutationFn: async (policyData) => {
      const result = await base44.entities.Policy.create(policyData);
      await logAuditEvent(user, 'policy', result.id, 'create', policyData);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      closeDialog();
    },
  });

  const updatePolicyMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await base44.entities.Policy.update(id, data);
      await logAuditEvent(user, 'policy', id, 'update', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      closeDialog();
    },
  });

  const deletePolicyMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.Policy.delete(id);
      await logAuditEvent(user, 'policy', id, 'delete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      setDeleteDialog({ open: false, policy: null });
    },
  });

  const openCreateDialog = () => {
    setForm({
      name: '',
      category: '',
      dailyLimitBase: '',
      perTxnLimitBase: '',
      requiresReceipt: true,
      notes: ''
    });
    setEditDialog({ open: true, policy: null });
  };

  const openEditDialog = (policy) => {
    setForm({
      name: policy.name || '',
      category: policy.category || '',
      dailyLimitBase: policy.dailyLimitBase?.toString() || '',
      perTxnLimitBase: policy.perTxnLimitBase?.toString() || '',
      requiresReceipt: policy.requiresReceipt !== false,
      notes: policy.notes || ''
    });
    setEditDialog({ open: true, policy });
  };

  const closeDialog = () => {
    setEditDialog({ open: false, policy: null });
    setForm({
      name: '',
      category: '',
      dailyLimitBase: '',
      perTxnLimitBase: '',
      requiresReceipt: true,
      notes: ''
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const policyData = {
      name: form.name,
      category: form.category,
      dailyLimitBase: form.dailyLimitBase ? parseFloat(form.dailyLimitBase) : null,
      perTxnLimitBase: form.perTxnLimitBase ? parseFloat(form.perTxnLimitBase) : null,
      requiresReceipt: form.requiresReceipt,
      notes: form.notes
    };

    if (editDialog.policy) {
      updatePolicyMutation.mutate({ id: editDialog.policy.id, data: policyData });
    } else {
      createPolicyMutation.mutate(policyData);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Access denied. Admin only.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Expense Policies</h1>
          <p className="text-gray-500 mt-1">Manage spending limits and requirements</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Policy
        </Button>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Policy Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Per Transaction Limit</TableHead>
                <TableHead className="text-right">Daily Limit</TableHead>
                <TableHead>Receipt Required</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 mx-auto" />
                  </TableCell>
                </TableRow>
              ) : policies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <Shield className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No policies defined yet</p>
                    <Button variant="link" onClick={openCreateDialog} className="mt-2">
                      Create your first policy
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                policies.map((policy) => (
                  <TableRow key={policy.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{policy.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {getCategoryLabel(policy.category)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {policy.perTxnLimitBase 
                        ? formatCurrency(policy.perTxnLimitBase, baseCurrency)
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {policy.dailyLimitBase 
                        ? formatCurrency(policy.dailyLimitBase, baseCurrency)
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary"
                        className={policy.requiresReceipt 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'}
                      >
                        {policy.requiresReceipt ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(policy)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => setDeleteDialog({ open: true, policy })}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialog.open} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editDialog.policy ? 'Edit Policy' : 'Create Policy'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Policy Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Standard Travel Policy"
                required
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="perTxnLimitBase">Per Transaction Limit ({baseCurrency})</Label>
                <Input
                  id="perTxnLimitBase"
                  type="number"
                  step="0.01"
                  value={form.perTxnLimitBase}
                  onChange={(e) => setForm(f => ({ ...f, perTxnLimitBase: e.target.value }))}
                  placeholder="e.g., 500"
                />
              </div>
              <div>
                <Label htmlFor="dailyLimitBase">Daily Limit ({baseCurrency})</Label>
                <Input
                  id="dailyLimitBase"
                  type="number"
                  step="0.01"
                  value={form.dailyLimitBase}
                  onChange={(e) => setForm(f => ({ ...f, dailyLimitBase: e.target.value }))}
                  placeholder="e.g., 1000"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="requiresReceipt">Receipt Required</Label>
              <Switch
                id="requiresReceipt"
                checked={form.requiresReceipt}
                onCheckedChange={(checked) => setForm(f => ({ ...f, requiresReceipt: checked }))}
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Additional policy notes..."
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                {editDialog.policy ? 'Save Changes' : 'Create Policy'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, policy: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Policy</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteDialog.policy?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, policy: null })}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteDialog.policy && deletePolicyMutation.mutate(deleteDialog.policy.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}