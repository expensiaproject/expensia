import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Upload,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Receipt,
  Sparkles,
  RotateCcw,
  X,
  Image as ImageIcon,
  Camera,
  FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CATEGORIES, PAYMENT_METHODS, CURRENCIES, getCategoryLabel } from '@/components/shared/CategoryHelpers';
import { logAuditEvent } from '@/components/shared/AuditLogger';
import { analyzeReceipt } from '@/components/shared/ReceiptAnalyzer';
import { fetchFXRate, calculateBaseAmount } from '@/components/shared/FXRateService';

export default function ExpenseFormModal({ 
  open, 
  onClose, 
  reportId, 
  expense = null, // For editing
  initialReceiptUrl = null, // Pre-uploaded receipt
  onSuccess 
}) {
  const queryClient = useQueryClient();
  const isEditing = !!expense;

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: policies = [] } = useQuery({
    queryKey: ['policies'],
    queryFn: () => base44.entities.Policy.list(),
  });

  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    merchant: '',
    category: '',
    description: '',
    amount: '',
    currency: 'USD',
    baseCurrency: null,
    taxAmount: '',
    paymentMethod: 'card',
    receiptUrl: '',
    exchangeRate: null,
    baseAmount: null,
  });

  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isFetchingFX, setIsFetchingFX] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [ocrConfidence, setOcrConfidence] = useState(null);
  const [ocrWarning, setOcrWarning] = useState(null);
  const [ocrSuccess, setOcrSuccess] = useState(null);
  const [errors, setErrors] = useState({});
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);

  // Track if OCR has been triggered for current receipt
  const [ocrTriggeredFor, setOcrTriggeredFor] = useState(null);

  // Fetch report to get tripCurrency
  const { data: currentReport } = useQuery({
    queryKey: ['report', reportId],
    queryFn: () => base44.entities.Report.filter({ id: reportId }).then(r => r?.[0]),
    enabled: !!reportId && open,
  });

  // Reset form when modal opens or expense changes
  useEffect(() => {
    if (open) {
      if (expense) {
        setForm({
          date: expense.date || format(new Date(), 'yyyy-MM-dd'),
          merchant: expense.merchant || '',
          category: expense.category || '',
          description: expense.description || '',
          amount: expense.amount?.toString() || '',
          currency: expense.currency || 'USD',
          baseCurrency: expense.baseCurrency || null,
          taxAmount: expense.taxAmount?.toString() || '',
          paymentMethod: expense.paymentMethod || 'card',
          receiptUrl: expense.receiptUrl || '',
          exchangeRate: expense.exchangeRate || null,
          baseAmount: expense.baseAmount || null,
        });
        setExtractedData(expense.extractedFieldsOriginal ? { extractedFieldsOriginal: expense.extractedFieldsOriginal } : null);
        setOcrTriggeredFor(null);
      } else {
        setForm({
          date: format(new Date(), 'yyyy-MM-dd'),
          merchant: '',
          category: '',
          description: '',
          amount: '',
          currency: 'USD',
          baseCurrency: null,
          taxAmount: '',
          paymentMethod: 'card',
          receiptUrl: initialReceiptUrl || '',
          exchangeRate: null,
          baseAmount: null,
        });
        setExtractedData(null);
        setOcrTriggeredFor(null);
      }
      setErrors({});
      setOcrWarning(null);
      setOcrSuccess(null);
      setOcrConfidence(null);
    }
  }, [open, expense, initialReceiptUrl]);

  // Auto-process receipt with OCR when modal opens with initial receipt
  useEffect(() => {
    if (open && initialReceiptUrl && !expense && ocrTriggeredFor !== initialReceiptUrl) {
      setOcrTriggeredFor(initialReceiptUrl);
      processReceiptOCR(initialReceiptUrl, false);
    }
  }, [open, initialReceiptUrl, expense, ocrTriggeredFor]);

  // Set baseCurrency from report's tripCurrency
  useEffect(() => {
    if (currentReport && open && !expense) {
      // For new expenses, use report's tripCurrency if available
      if (currentReport.tripCurrency) {
        setForm(f => ({ ...f, baseCurrency: currentReport.tripCurrency }));
      }
    }
  }, [currentReport, open, expense]);

  // Handle currency conversion logic
  useEffect(() => {
    const handleConversion = async () => {
      if (!form.currency || !form.amount || !form.baseCurrency) return;

      const amount = parseFloat(form.amount) || 0;

      // Same currency - no conversion needed
      if (form.currency === form.baseCurrency) {
        setForm(f => ({
          ...f,
          exchangeRate: null,
          baseAmount: amount
        }));
        return;
      }

      // Different currency - need exchange rate
      if (!form.exchangeRate) {
        setIsFetchingFX(true);
        try {
          const rate = await fetchFXRate(form.currency, form.baseCurrency, form.date);
          const baseAmt = calculateBaseAmount(amount, rate);
          
          setForm(f => ({
            ...f,
            exchangeRate: rate,
            baseAmount: baseAmt
          }));
        } catch (error) {
          console.error('Failed to fetch FX rate:', error);
        } finally {
          setIsFetchingFX(false);
        }
      } else {
        // Recalculate with existing rate
        const baseAmt = calculateBaseAmount(amount, form.exchangeRate);
        setForm(f => ({ ...f, baseAmount: baseAmt }));
      }
    };

    handleConversion();
  }, [form.currency, form.baseCurrency, form.amount, form.date]);

  // OCR Processing using shared analyzeReceipt AI action
  const processReceiptOCR = async (fileUrl, forceOverwrite = false) => {
    if (!fileUrl) {
      console.error('No file URL provided for OCR');
      return;
    }
    
    console.log('Starting OCR for:', fileUrl);
    setIsExtracting(true);
    setOcrWarning(null);
    setOcrSuccess(null);
    setOcrConfidence(null);
    
    try {
      // Call the AI receipt analyzer
      const result = await analyzeReceipt(fileUrl);
      console.log('OCR result:', result);
      
      if (!result.success) {
        // No useful data extracted at all
        setOcrWarning(result.error || "Couldn't read this receipt. Please fill in manually.");
        setIsExtracting(false);
        return;
      }
      
      const data = result.data;
      
      setOcrConfidence(data.confidence || 0);
      setExtractedData({
        extractedFieldsOriginal: {
          raw_text: data.rawText,
          language: data.language,
          confidence: data.confidence,
          merchant: data.merchantOriginal,
          description: data.descriptionOriginal,
        },
        extractedFieldsEnglish: {
          merchant: data.merchant,
          description: data.description,
        }
      });
      
      // Autofill - only fill empty fields unless forceOverwrite is true
      setForm(f => {
        const todayDate = format(new Date(), 'yyyy-MM-dd');
        const isDateDefault = f.date === todayDate;
        const isCurrencyDefault = f.currency === 'USD';
        
        // Validate extracted currency
        const validCurrency = data.currency && CURRENCIES.includes(data.currency) ? data.currency : null;
        
        // Validate extracted category
        const validCategory = data.category && CATEGORIES.find(c => c.value === data.category) ? data.category : null;
        
        return {
          ...f,
          // Merchant: fill if empty or force overwrite
          merchant: forceOverwrite ? (data.merchant || f.merchant) : (f.merchant || data.merchant || ''),
          // Date: fill if still default today's date or force overwrite
          date: forceOverwrite ? (data.date || f.date) : (isDateDefault && data.date ? data.date : f.date),
          // Currency: fill if still default USD or force overwrite
          currency: forceOverwrite ? (validCurrency || f.currency) : (isCurrencyDefault && validCurrency ? validCurrency : f.currency),
          // Amount: fill if empty or force overwrite
          amount: forceOverwrite ? (data.amount?.toString() || f.amount) : (f.amount || (data.amount ? data.amount.toString() : '')),
          // Tax: fill if empty or force overwrite
          taxAmount: forceOverwrite ? (data.taxAmount?.toString() || f.taxAmount) : (f.taxAmount || (data.taxAmount ? data.taxAmount.toString() : '')),
          // Description: fill if empty or force overwrite
          description: forceOverwrite ? (data.description || f.description) : (f.description || data.description || ''),
          // Category: fill if empty or force overwrite
          category: forceOverwrite ? (validCategory || f.category) : (f.category || validCategory || ''),
        };
      });
      
      // Success message
      setOcrSuccess('Receipt processed with AI. Please review the details.');
      
    } catch (error) {
      console.error('OCR failed:', error);
      setOcrWarning("Couldn't read this receipt. Please fill in manually.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleReceiptUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setErrors(err => ({ ...err, receipt: 'Please upload a JPG, PNG, or PDF receipt' }));
      return;
    }

    console.log('Uploading receipt:', file.type, file.name);
    
    setIsUploading(true);
    setOcrWarning(null);
    setOcrSuccess(null);
    setOcrConfidence(null);
    setExtractedData(null);
    setUploadMenuOpen(false);
    
    try {
      console.log('Uploading file:', file.name);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      console.log('File uploaded, URL:', file_url);
      setForm(f => ({ ...f, receiptUrl: file_url }));
      setIsUploading(false);
      
      // Immediately trigger OCR after upload
      console.log('Starting OCR after upload...');
      await processReceiptOCR(file_url, false);
    } catch (error) {
      console.error('Upload failed:', error);
      setOcrWarning('Failed to upload receipt. Please try again.');
      setIsUploading(false);
      setIsExtracting(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const result = await base44.entities.Expense.create(data);
      await logAuditEvent(user, 'expense', result.id, 'create');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', 'report', reportId] });
      onSuccess?.();
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await base44.entities.Expense.update(id, data);
      await logAuditEvent(user, 'expense', id, 'update');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', 'report', reportId] });
      onSuccess?.();
      onClose();
    },
  });

  const handleSubmit = (e, submitExpense = false) => {
    e.preventDefault();
    
    const newErrors = {};
    if (!form.merchant) newErrors.merchant = 'Required';
    if (!form.category) newErrors.category = 'Required';
    if (!form.amount) newErrors.amount = 'Required';
    if (!form.date) newErrors.date = 'Required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    // Check policies
    const policyFlags = [];
    const policy = policies.find(p => p.category === form.category);
    if (policy) {
      const amount = parseFloat(form.amount) || 0;
      if (policy.perTxnLimit && amount > policy.perTxnLimit) {
        policyFlags.push(`Exceeds limit of ${policy.perTxnLimit}`);
      }
      if (policy.requiresReceipt && !form.receiptUrl) {
        policyFlags.push('Receipt required');
      }
    }
    
    // If this is the first expense in the report, set tripCurrency
    let reportUpdateData = null;
    if (!isEditing && currentReport && !currentReport.tripCurrency) {
      reportUpdateData = { tripCurrency: form.currency };
    }

    const expenseData = {
      employeeId: user.id,
      date: form.date,
      merchant: form.merchant,
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount) || 0,
      currency: form.currency,
      baseCurrency: form.baseCurrency || form.currency,
      exchangeRate: form.exchangeRate,
      baseAmount: form.baseAmount || parseFloat(form.amount) || 0,
      taxAmount: form.taxAmount ? parseFloat(form.taxAmount) : null,
      paymentMethod: form.paymentMethod,
      receiptUrl: form.receiptUrl,
      extractedFieldsOriginal: extractedData?.extractedFieldsOriginal || null,
      extractedFieldsEnglish: extractedData?.extractedFieldsEnglish || null,
      policyFlags,
      status: submitExpense ? 'submitted' : 'draft',
      reportId: reportId,
    };
    
    if (isEditing) {
      updateMutation.mutate({ id: expense.id, data: expenseData });
    } else {
      // Create expense and update report if needed
      if (reportUpdateData) {
        createMutation.mutate(expenseData, {
          onSuccess: () => {
            base44.entities.Report.update(reportId, reportUpdateData);
            queryClient.invalidateQueries({ queryKey: ['report', reportId] });
          }
        });
      } else {
        createMutation.mutate(expenseData);
      }
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-indigo-600" />
            {isEditing ? 'Edit Expense' : 'Add Expense'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-5">
          {/* Receipt Upload */}
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-indigo-300 transition-colors">
            <input id="photo-library-input" type="file" accept="image/*" onChange={handleReceiptUpload} className="hidden" />
            <input id="take-photo-input" type="file" accept="image/*" capture="environment" onChange={handleReceiptUpload} className="hidden" />
            <input id="choose-file-input" type="file" accept="image/*,.pdf" onChange={handleReceiptUpload} className="hidden" />

            {form.receiptUrl ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Receipt uploaded</span>
                </div>
                {form.receiptUrl.toLowerCase().includes('.pdf') ? (
                  <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                    <Receipt className="h-10 w-10 text-indigo-600 mx-auto" />
                    <p className="text-sm text-indigo-700 font-medium mt-2">PDF Receipt</p>
                    <a 
                      href={form.receiptUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:underline mt-1 inline-block"
                    >
                      View PDF
                    </a>
                  </div>
                ) : (
                  <img src={form.receiptUrl} alt="Receipt" className="max-h-32 mx-auto rounded-lg" />
                )}
                {extractedData && (
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-indigo-700 font-medium">
                        <Sparkles className="h-3 w-3" /> AI extracted
                      </span>
                      {ocrConfidence !== null && (
                        <span className={`px-1.5 py-0.5 rounded-full ${
                          ocrConfidence >= 80 ? 'bg-green-100 text-green-700' :
                          ocrConfidence >= 60 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {Math.round(ocrConfidence)}%
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {ocrSuccess && (
                  <p className="text-xs text-green-600 flex items-center justify-center gap-1">
                    <CheckCircle className="h-3 w-3" /> {ocrSuccess}
                  </p>
                )}
                {ocrWarning && (
                  <p className="text-xs text-amber-600 flex items-center justify-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {ocrWarning}
                  </p>
                )}
                <div className="flex gap-2 justify-center">
                  <Button 
                    type="button" variant="outline" size="sm"
                    onClick={() => processReceiptOCR(form.receiptUrl, true)}
                    disabled={isExtracting}
                  >
                    {isExtracting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                    Re-OCR
                  </Button>
                  <Button 
                    type="button" variant="outline" size="sm"
                    onClick={() => {
                      setForm(f => ({ ...f, receiptUrl: '' }));
                      setExtractedData(null);
                    }}
                  >
                    <X className="h-3 w-3 mr-1" /> Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-4">
                {isUploading || isExtracting ? (
                  <div className="flex flex-col items-center gap-1">
                    <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                    <span className="text-sm text-gray-600">{isExtracting ? 'Reading receipt with AI…' : 'Uploading...'}</span>
                  </div>
                ) : (
                  <>
                    <Popover open={uploadMenuOpen} onOpenChange={setUploadMenuOpen}>
                      <PopoverTrigger asChild>
                        <button type="button" className="w-full">
                          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-1" />
                          <p className="text-sm text-gray-600 font-medium">Click to upload receipt</p>
                          <p className="text-xs text-gray-400">AI will extract details automatically</p>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-2" align="center">
                        <div className="space-y-1">
                          <button
                            type="button"
                            onClick={() => document.getElementById('photo-library-input').click()}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <ImageIcon className="h-5 w-5 text-gray-600" />
                            <span className="text-sm font-medium">Photo Library</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => document.getElementById('take-photo-input').click()}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Camera className="h-5 w-5 text-gray-600" />
                            <span className="text-sm font-medium">Take Photo</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => document.getElementById('choose-file-input').click()}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <FolderOpen className="h-5 w-5 text-gray-600" />
                            <span className="text-sm font-medium">Choose File</span>
                          </button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Date *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                className={`h-9 ${errors.date ? 'border-red-500' : ''}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Merchant *</Label>
              <Input
                placeholder="e.g., Singapore Airlines"
                value={form.merchant}
                onChange={(e) => setForm(f => ({ ...f, merchant: e.target.value }))}
                className={`h-9 ${errors.merchant ? 'border-red-500' : ''}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Category *</Label>
              <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className={`h-9 ${errors.category ? 'border-red-500' : ''}`}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Payment Method</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => setForm(f => ({ ...f, paymentMethod: v }))}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(pm => (
                    <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Amount *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                className={`h-9 ${errors.amount ? 'border-red-500' : ''}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Currency</Label>
              <Select value={form.currency} onValueChange={(v) => setForm(f => ({ ...f, currency: v }))}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tax (Optional)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.taxAmount}
                onChange={(e) => setForm(f => ({ ...f, taxAmount: e.target.value }))}
                className="h-9"
              />
            </div>
          </div>

          {/* FX Rate Section */}
          {form.baseCurrency && form.currency !== form.baseCurrency && (
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Currency Conversion</Label>
                {isFetchingFX && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Fetching rate...
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Exchange Rate (1 {form.currency} = X {form.baseCurrency}) *</Label>
                  <Input
                    type="number"
                    step="0.000001"
                    placeholder="Required"
                    value={form.exchangeRate || ''}
                    onChange={(e) => {
                      const rate = parseFloat(e.target.value) || null;
                      const baseAmt = rate ? calculateBaseAmount(parseFloat(form.amount) || 0, rate) : null;
                      setForm(f => ({ ...f, exchangeRate: rate, baseAmount: baseAmt }));
                    }}
                    className="h-9"
                  />
                  <p className="text-xs text-gray-500">Auto-fetched, editable</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Amount in {form.baseCurrency}</Label>
                  <Input
                    type="text"
                    value={form.baseAmount ? form.baseAmount.toFixed(2) : ''}
                    readOnly
                    className="h-9 bg-gray-50"
                  />
                  <p className="text-xs text-gray-500">Calculated automatically</p>
                </div>
              </div>
            </div>
          )}

          {form.baseCurrency && form.currency === form.baseCurrency && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-100">
              <p className="text-xs text-green-700">
                ✓ Same currency as trip - no conversion needed
              </p>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Description (Optional)</Label>
            <Textarea
              placeholder="Add notes..."
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-3 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="outline" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save as Draft
            </Button>
            <Button 
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              disabled={isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}