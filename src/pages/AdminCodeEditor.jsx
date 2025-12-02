import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Code, ExternalLink } from 'lucide-react';

export default function AdminCodeEditor() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const isAdmin = user?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Access denied. Admin only.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Code Editor</h1>
        <p className="text-sm text-gray-500 mt-1">Access the Base44 code editor to customize this application</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5 text-indigo-600" />
            Application Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            Use the Base44 platform to edit the source code of this application. You can customize pages, components, entities, and more.
          </p>
          
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-gray-900">What you can do:</h3>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Edit page layouts and components</li>
              <li>Modify entity schemas and data structures</li>
              <li>Customize styling and themes</li>
              <li>Add new features and integrations</li>
              <li>Configure AI-powered functions</li>
            </ul>
          </div>

          <Button 
            onClick={() => window.open('https://base44.com', '_blank')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Base44 Editor
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}