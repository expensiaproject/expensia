import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Search,
  History,
  Filter,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function AdminAuditLogs() {
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [viewDialog, setViewDialog] = useState({ open: false, log: null });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 500),
  });

  const getActionColor = (action) => {
    const colors = {
      create: 'bg-green-100 text-green-800',
      update: 'bg-blue-100 text-blue-800',
      delete: 'bg-red-100 text-red-800',
      view: 'bg-gray-100 text-gray-800',
      export: 'bg-purple-100 text-purple-800',
      submit: 'bg-amber-100 text-amber-800',
      approve: 'bg-emerald-100 text-emerald-800',
      reject: 'bg-rose-100 text-rose-800'
    };
    return colors[action] || 'bg-gray-100 text-gray-800';
  };

  const getEntityColor = (entity) => {
    const colors = {
      expense: 'bg-indigo-100 text-indigo-800',
      report: 'bg-purple-100 text-purple-800',
      policy: 'bg-cyan-100 text-cyan-800',
      user: 'bg-emerald-100 text-emerald-800',
      project: 'bg-amber-100 text-amber-800',
      data_policy: 'bg-rose-100 text-rose-800'
    };
    return colors[entity] || 'bg-gray-100 text-gray-800';
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = !search || 
      log.actorEmail?.toLowerCase().includes(search.toLowerCase()) ||
      log.entityId?.toLowerCase().includes(search.toLowerCase());
    const matchesEntity = entityFilter === 'all' || log.entity === entityFilter;
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    return matchesSearch && matchesEntity && matchesAction;
  });

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
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-500 mt-1">Track all system activity</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by actor or entity ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="report">Report</SelectItem>
                <SelectItem value="policy">Policy</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="data_policy">Data Policy</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="view">View</SelectItem>
                <SelectItem value="export">Export</SelectItem>
                <SelectItem value="submit">Submit</SelectItem>
                <SelectItem value="approve">Approve</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <History className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No audit logs found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-gray-50">
                    <TableCell className="text-sm">
                      {log.created_date && format(new Date(log.created_date), 'MMM d, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{log.actorEmail || log.actorId}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getActionColor(log.action)}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getEntityColor(log.entity)}>
                        {log.entity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-mono text-gray-500">
                        {log.entityId?.slice(0, 8)}...
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setViewDialog({ open: true, log })}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* View Dialog */}
      <Dialog open={viewDialog.open} onOpenChange={(open) => setViewDialog({ open, log: null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
          </DialogHeader>
          {viewDialog.log && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Timestamp</p>
                  <p className="font-medium">
                    {viewDialog.log.created_date && format(new Date(viewDialog.log.created_date), 'PPP HH:mm:ss')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Actor</p>
                  <p className="font-medium">{viewDialog.log.actorEmail || viewDialog.log.actorId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Action</p>
                  <Badge className={getActionColor(viewDialog.log.action)}>
                    {viewDialog.log.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Entity</p>
                  <Badge className={getEntityColor(viewDialog.log.entity)}>
                    {viewDialog.log.entity}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Entity ID</p>
                <p className="font-mono text-sm">{viewDialog.log.entityId}</p>
              </div>
              {viewDialog.log.diff && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Changes</p>
                  <pre className="p-3 bg-gray-50 rounded-lg text-xs overflow-auto max-h-48">
                    {JSON.stringify(viewDialog.log.diff, null, 2)}
                  </pre>
                </div>
              )}
              {viewDialog.log.meta && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Metadata</p>
                  <pre className="p-3 bg-gray-50 rounded-lg text-xs overflow-auto max-h-32">
                    {JSON.stringify(viewDialog.log.meta, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}