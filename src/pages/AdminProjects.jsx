import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  FolderKanban,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { formatCurrency } from '../components/shared/CategoryHelpers';
import { logAuditEvent } from '../components/shared/AuditLogger';

export default function AdminProjects() {
  const queryClient = useQueryClient();
  const [editDialog, setEditDialog] = useState({ open: false, project: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, project: null });
  const [form, setForm] = useState({
    code: '',
    name: '',
    budgetBase: '',
    ownerId: '',
    active: true
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: allExpenses = [] } = useQuery({
    queryKey: ['allExpenses'],
    queryFn: () => base44.entities.Expense.list('-date', 5000),
  });

  const baseCurrency = 'USD';

  const getUserName = (userId) => {
    const u = allUsers.find(u => u.id === userId);
    return u?.full_name || u?.email || '-';
  };

  const getProjectSpend = (projectId) => {
    return allExpenses
      .filter(e => e.projectId === projectId)
      .reduce((sum, e) => sum + (e.amountInBase || 0), 0);
  };

  const createProjectMutation = useMutation({
    mutationFn: async (projectData) => {
      const result = await base44.entities.Project.create(projectData);
      await logAuditEvent(user, 'project', result.id, 'create', projectData);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      closeDialog();
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await base44.entities.Project.update(id, data);
      await logAuditEvent(user, 'project', id, 'update', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      closeDialog();
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.Project.delete(id);
      await logAuditEvent(user, 'project', id, 'delete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setDeleteDialog({ open: false, project: null });
    },
  });

  const openCreateDialog = () => {
    setForm({
      code: '',
      name: '',
      budgetBase: '',
      ownerId: '',
      active: true
    });
    setEditDialog({ open: true, project: null });
  };

  const openEditDialog = (project) => {
    setForm({
      code: project.code || '',
      name: project.name || '',
      budgetBase: project.budgetBase?.toString() || '',
      ownerId: project.ownerId || '',
      active: project.active !== false
    });
    setEditDialog({ open: true, project });
  };

  const closeDialog = () => {
    setEditDialog({ open: false, project: null });
    setForm({
      code: '',
      name: '',
      budgetBase: '',
      ownerId: '',
      active: true
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const projectData = {
      code: form.code,
      name: form.name,
      budgetBase: form.budgetBase ? parseFloat(form.budgetBase) : null,
      ownerId: form.ownerId || null,
      active: form.active
    };

    if (editDialog.project) {
      updateProjectMutation.mutate({ id: editDialog.project.id, data: projectData });
    } else {
      createProjectMutation.mutate(projectData);
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
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500 mt-1">Manage project codes and budgets</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Project
        </Button>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead className="text-right">Spent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 mx-auto" />
                  </TableCell>
                </TableRow>
              ) : projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <FolderKanban className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No projects defined yet</p>
                    <Button variant="link" onClick={openCreateDialog} className="mt-2">
                      Create your first project
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((project) => {
                  const spent = getProjectSpend(project.id);
                  const overBudget = project.budgetBase && spent > project.budgetBase;
                  return (
                    <TableRow key={project.id} className="hover:bg-gray-50">
                      <TableCell className="font-mono font-medium">{project.code}</TableCell>
                      <TableCell>{project.name}</TableCell>
                      <TableCell>{getUserName(project.ownerId)}</TableCell>
                      <TableCell className="text-right">
                        {project.budgetBase 
                          ? formatCurrency(project.budgetBase, baseCurrency)
                          : '-'}
                      </TableCell>
                      <TableCell className={`text-right ${overBudget ? 'text-red-600 font-medium' : ''}`}>
                        {formatCurrency(spent, baseCurrency)}
                        {overBudget && <span className="text-xs ml-1">(over)</span>}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary"
                          className={project.active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'}
                        >
                          {project.active ? 'Active' : 'Inactive'}
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
                            <DropdownMenuItem onClick={() => openEditDialog(project)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => setDeleteDialog({ open: true, project })}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
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
              {editDialog.project ? 'Edit Project' : 'Create Project'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="code">Project Code</Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))}
                  placeholder="e.g., PRJ-001"
                  required
                />
              </div>
              <div>
                <Label htmlFor="budgetBase">Budget ({baseCurrency})</Label>
                <Input
                  id="budgetBase"
                  type="number"
                  step="0.01"
                  value={form.budgetBase}
                  onChange={(e) => setForm(f => ({ ...f, budgetBase: e.target.value }))}
                  placeholder="e.g., 50000"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Tokyo Office Expansion"
                required
              />
            </div>
            <div>
              <Label htmlFor="ownerId">Project Owner</Label>
              <Select value={form.ownerId} onValueChange={(v) => setForm(f => ({ ...f, ownerId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>No Owner</SelectItem>
                  {allUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="active">Active</Label>
              <Switch
                id="active"
                checked={form.active}
                onCheckedChange={(checked) => setForm(f => ({ ...f, active: checked }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                {editDialog.project ? 'Save Changes' : 'Create Project'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, project: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteDialog.project?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, project: null })}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteDialog.project && deleteProjectMutation.mutate(deleteDialog.project.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}