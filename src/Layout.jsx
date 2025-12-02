import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Receipt,
  FileText,
  Users,
  Settings,
  Shield,
  History,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bot,
  Database,
  Plane
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const isAdmin = user?.role === 'admin';
  
  const userNavItems = [
    { name: 'Dashboard', page: 'Home', icon: LayoutDashboard },
    { name: 'My Expenses', page: 'MyExpenses', icon: Receipt },
    { name: 'My Reports', page: 'MyReports', icon: FileText },
    { name: 'Create Trip', page: 'CreateTripReport', icon: Plane },
    { name: 'AI Assistant', page: 'Assistant', icon: Bot },
  ];
  
  const adminNavItems = [
    { name: 'Admin Dashboard', page: 'AdminDashboard', icon: LayoutDashboard },
    { name: 'All Expenses', page: 'AdminExpenses', icon: Receipt },
    { name: 'All Reports', page: 'AdminReports', icon: FileText },
    { name: 'Users', page: 'AdminUsers', icon: Users },
    { name: 'Policies', page: 'AdminPolicies', icon: Shield },
    { name: 'Audit Logs', page: 'AdminAuditLogs', icon: History },
    { name: 'Data Settings', page: 'AdminDataPolicy', icon: Database },
  ];

  const navItems = isAdmin ? [...userNavItems, ...adminNavItems] : userNavItems;
  
  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Receipt className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Expensia
            </span>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-indigo-100 text-indigo-700 text-sm">
                  {getInitials(user?.full_name)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.full_name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
              <p className="text-xs text-indigo-600 capitalize mt-1">{user?.role}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="h-4 w-4 mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50
        transform transition-transform duration-200 ease-in-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-100">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Receipt className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Expensia
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-3">
            {!isAdmin && (
              <div className="mb-2">
                <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  My Workspace
                </p>
                {userNavItems.map((item) => (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all duration-150
                      ${currentPageName === item.page 
                        ? 'bg-indigo-50 text-indigo-700 font-medium' 
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                    `}
                  >
                    <item.icon className={`h-5 w-5 ${currentPageName === item.page ? 'text-indigo-600' : ''}`} />
                    {item.name}
                  </Link>
                ))}
              </div>
            )}
            
            {isAdmin && (
              <>
                <div className="mb-4">
                  <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    My Workspace
                  </p>
                  {userNavItems.map((item) => (
                    <Link
                      key={item.page}
                      to={createPageUrl(item.page)}
                      onClick={() => setSidebarOpen(false)}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all duration-150
                        ${currentPageName === item.page 
                          ? 'bg-indigo-50 text-indigo-700 font-medium' 
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                      `}
                    >
                      <item.icon className={`h-5 w-5 ${currentPageName === item.page ? 'text-indigo-600' : ''}`} />
                      {item.name}
                    </Link>
                  ))}
                </div>
                
                <div>
                  <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Administration
                  </p>
                  {adminNavItems.map((item) => (
                    <Link
                      key={item.page}
                      to={createPageUrl(item.page)}
                      onClick={() => setSidebarOpen(false)}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all duration-150
                        ${currentPageName === item.page 
                          ? 'bg-indigo-50 text-indigo-700 font-medium' 
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                      `}
                    >
                      <item.icon className={`h-5 w-5 ${currentPageName === item.page ? 'text-indigo-600' : ''}`} />
                      {item.name}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-gray-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 h-auto py-2">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-sm">
                      {getInitials(user?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
                    <p className="text-xs text-indigo-600 capitalize">{user?.role}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.full_name}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}