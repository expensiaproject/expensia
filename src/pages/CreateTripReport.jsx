import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plane, Calendar, Users, MapPin, ArrowRight, Upload, Loader2 } from 'lucide-react';

export default function CreateTripReport() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const [form, setForm] = useState({
    tripName: '',
    tripStartDate: format(new Date(), 'yyyy-MM-dd'),
    tripEndDate: format(new Date(), 'yyyy-MM-dd'),
    travelerCount: 1,
    destination: '',
  });

  const [errors, setErrors] = useState({});
  const [pendingReceipts, setPendingReceipts] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const createReportMutation = useMutation({
    mutationFn: (data) => base44.entities.Report.create(data),
    onSuccess: (newReport) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      // Navigate with pending receipts if uploaded
      const url = pendingReceipts.length > 0
        ? `TripReportDetails?id=${newReport.id}&receiptUrls=${encodeURIComponent(JSON.stringify(pendingReceipts))}`
        : `TripReportDetails?id=${newReport.id}`;
      navigate(createPageUrl(url));
    },
  });

  const handleReceiptUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    const invalidFiles = files.filter(f => !validTypes.includes(f.type));
    if (invalidFiles.length > 0) {
      setErrors(err => ({ ...err, receipt: 'Please upload only JPG, PNG, or PDF files' }));
      return;
    }
    
    setIsUploading(true);
    setErrors(err => ({ ...err, receipt: null }));
    
    try {
      const uploadPromises = files.map(file => base44.integrations.Core.UploadFile({ file }));
      const results = await Promise.all(uploadPromises);
      const newUrls = results.map(r => r.file_url);
      setPendingReceipts(prev => [...prev, ...newUrls]);
    } catch (error) {
      console.error('Upload failed:', error);
      setErrors(err => ({ ...err, receipt: 'Failed to upload some receipts' }));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const removeReceipt = (index) => {
    setPendingReceipts(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    const newErrors = {};
    if (!form.tripName.trim()) newErrors.tripName = 'Trip name is required';
    if (!form.tripStartDate) newErrors.tripStartDate = 'Start date is required';
    if (!form.tripEndDate) newErrors.tripEndDate = 'End date is required';
    if (!form.travelerCount || form.travelerCount < 1) newErrors.travelerCount = 'At least 1 traveler required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    createReportMutation.mutate({
      title: form.tripName,
      employeeId: user?.id,
      tripStartDate: form.tripStartDate,
      tripEndDate: form.tripEndDate,
      travelerCount: parseInt(form.travelerCount),
      destination: form.destination || null,
      totalAmount: 0,
      status: 'open',
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Create Trip Report</h1>
        <p className="text-gray-500 mt-1">Enter your trip details to start adding expenses</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-indigo-600" />
            Trip Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-1.5">
            <Label htmlFor="tripName">Trip Name *</Label>
            <Input
              id="tripName"
              placeholder="e.g., Tokyo Business Conference 2024"
              value={form.tripName}
              onChange={(e) => setForm(f => ({ ...f, tripName: e.target.value }))}
              className={errors.tripName ? 'border-red-500' : ''}
            />
            {errors.tripName && <p className="text-sm text-red-500">{errors.tripName}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="tripStartDate" className="flex items-center gap-1">
                <Calendar className="h-4 w-4" /> Start Date *
              </Label>
              <Input
                id="tripStartDate"
                type="date"
                value={form.tripStartDate}
                onChange={(e) => setForm(f => ({ ...f, tripStartDate: e.target.value }))}
                className={errors.tripStartDate ? 'border-red-500' : ''}
              />
              {errors.tripStartDate && <p className="text-sm text-red-500">{errors.tripStartDate}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tripEndDate" className="flex items-center gap-1">
                <Calendar className="h-4 w-4" /> End Date *
              </Label>
              <Input
                id="tripEndDate"
                type="date"
                value={form.tripEndDate}
                onChange={(e) => setForm(f => ({ ...f, tripEndDate: e.target.value }))}
                className={errors.tripEndDate ? 'border-red-500' : ''}
              />
              {errors.tripEndDate && <p className="text-sm text-red-500">{errors.tripEndDate}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="travelerCount" className="flex items-center gap-1">
                <Users className="h-4 w-4" /> Number of Travelers *
              </Label>
              <Input
                id="travelerCount"
                type="number"
                min="1"
                value={form.travelerCount}
                onChange={(e) => setForm(f => ({ ...f, travelerCount: e.target.value }))}
                className={errors.travelerCount ? 'border-red-500' : ''}
              />
              {errors.travelerCount && <p className="text-sm text-red-500">{errors.travelerCount}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="destination" className="flex items-center gap-1">
                <MapPin className="h-4 w-4" /> Destination (Optional)
              </Label>
              <Input
                id="destination"
                placeholder="e.g., Tokyo, Japan"
                value={form.destination}
                onChange={(e) => setForm(f => ({ ...f, destination: e.target.value }))}
              />
            </div>
          </div>

          {/* Receipt Upload Section */}
          <div className="space-y-3">
            {pendingReceipts.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {pendingReceipts.map((url, index) => (
                  <div key={index} className="relative group border rounded-lg p-2 bg-gray-50">
                    {url.toLowerCase().includes('.pdf') ? (
                      <div className="h-20 flex items-center justify-center">
                        <span className="text-xs text-gray-500">PDF #{index + 1}</span>
                      </div>
                    ) : (
                      <img src={url} alt={`Receipt ${index + 1}`} className="h-20 w-full object-cover rounded" />
                    )}
                    <button
                      type="button"
                      onClick={() => removeReceipt(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-indigo-300 transition-colors">
              <label className="cursor-pointer block">
                <input 
                  type="file" 
                  accept="image/*,.pdf" 
                  multiple
                  onChange={handleReceiptUpload} 
                  className="hidden" 
                />
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                    <span className="text-sm text-gray-600">Uploading...</span>
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 font-medium">
                      {pendingReceipts.length > 0 ? 'Add more receipts' : 'Upload receipts (optional)'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {pendingReceipts.length > 0 
                        ? `${pendingReceipts.length} receipt${pendingReceipts.length > 1 ? 's' : ''} ready • AI will process each one`
                        : 'Select multiple files • AI will extract details automatically'}
                    </p>
                  </>
                )}
              </label>
            </div>
            {errors.receipt && <p className="text-sm text-red-500">{errors.receipt}</p>}
          </div>

          <div className="pt-4 border-t">
            <Button
              onClick={handleSubmit}
              disabled={createReportMutation.isPending || isUploading}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {createReportMutation.isPending ? 'Creating...' : 'Add Expenses'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}