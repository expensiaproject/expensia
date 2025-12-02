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
  X
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CATEGORIES, PAYMENT_METHODS, CURRENCIES, getCategoryLabel } from '@/components/shared/CategoryHelpers';
import { logAuditEvent } from '@/components/shared/AuditLogger';

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
    taxAmount: '',
    paymentMethod: 'card',
    receiptUrl: '',
    exchangeRate: '',
  });

  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [ocrConfidence, setOcrConfidence] = useState(null);
  const [ocrWarning, setOcrWarning] = useState(null);
  const [ocrSuccess, setOcrSuccess] = useState(null);
  const [errors, setErrors] = useState({});

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
          taxAmount: expense.taxAmount?.toString() || '',
          paymentMethod: expense.paymentMethod || 'card',
          receiptUrl: expense.receiptUrl || '',
          exchangeRate: expense.exchangeRate?.toString() || '',
        });
        setExtractedData(expense.extractedFieldsOriginal ? { extractedFieldsOriginal: expense.extractedFieldsOriginal } : null);
      } else {
        setForm({
          date: format(new Date(), 'yyyy-MM-dd'),
          merchant: '',
          category: '',
          description: '',
          amount: '',
          currency: 'USD',
          taxAmount: '',
          paymentMethod: 'card',
          receiptUrl: initialReceiptUrl || '',
          exchangeRate: '',
        });
        setExtractedData(null);
        
        // Auto-process if there's an initial receipt URL
        if (initialReceiptUrl) {
          processReceiptOCR(initialReceiptUrl, false);
        }
      }
      setErrors({});
      setOcrWarning(null);
      setOcrSuccess(null);
      setOcrConfidence(null);
    }
  }, [open, expense, initialReceiptUrl]);

  // OCR Processing
  const processReceiptOCR = async (fileUrl, forceOverwrite = false) => {
    setIsExtracting(true);
    setOcrWarning(null);
    setOcrSuccess(null);
    setOcrConfidence(null);
    
    try {
      const isPdf = fileUrl.toLowerCase().includes('.pdf') || fileUrl.toLowerCase().includes('application/pdf');
      
      const ocrResult = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an OCR engine processing a receipt ${isPdf ? 'PDF document' : 'image'}. 
Extract these fields:
- merchant: vendor/store name
- date: transaction date (format as YYYY-MM-DD)
- currency: currency code (USD, EUR, JPY, CNY, SGD, IDR, etc.)
- total_amount: final total amount (number only)
- tax_amount: tax/VAT amount if visible (number only)
- items_description: brief summary of items/services
- category: best match from [air_tickets, local_transport, overseas_transport, trip_insurance, communication, entertainment_hospitality, equipment_tools, gifts_souvenirs, other_business, miscellaneous]
- detected_language: language code of the text
- confidence_score: your confidence percentage (0-100)`,
        file_urls: fileUrl,
        response_json_schema: {
          type: 'object',
          properties: {
            raw_ocr_text: { type: 'string' },
            detected_language: { type: 'string' },
            confidence_score: { type: 'number' },
            merchant: { type: 'string' },
            date: { type: 'string' },
            currency: { type: 'string' },
            total_amount: { type: 'number' },
            tax_amount: { type: 'number' },
            items_description: { type: 'string' },
            category: { type: 'string' }
          }
        }
      });
      
      const hasData = ocrResult && (ocrResult.merchant || ocrResult.total_amount);
      if (!hasData) throw new Error('No data extracted');
      
      // Translate if not English
      let translatedMerchant = ocrResult.merchant || '';
      let translatedDescription = ocrResult.items_description || '';
      
      const needsTranslation = ocrResult.detected_language && 
        !['en', 'eng', 'english'].includes(ocrResult.detected_language.toLowerCase());
      
      if (needsTranslation && (ocrResult.merchant || ocrResult.items_description)) {
        try {
          const translationResult = await base44.integrations.Core.InvokeLLM({
            prompt: `Translate to English:
Merchant: ${ocrResult.merchant || 'N/A'}
Items: ${ocrResult.items_description || 'N/A'}`,
            response_json_schema: {
              type: 'object',
              properties: {
                merchant_english: { type: 'string' },
                description_english: { type: 'string' }
              }
            }
          });
          translatedMerchant = translationResult.merchant_english || ocrResult.merchant || '';
          translatedDescription = translationResult.description_english || ocrResult.items_description || '';
        } catch (e) {
          console.error('Translation failed:', e);
        }
      }
      
      setOcrConfidence(ocrResult.confidence_score || 0);
      setExtractedData({
        ...ocrResult,
        extractedFieldsOriginal: {
          raw_text: ocrResult.raw_ocr_text,
          language: ocrResult.detected_language,
          confidence: ocrResult.confidence_score,
        },
        extractedFieldsEnglish: {
          merchant: translatedMerchant,
          description: translatedDescription,
        }
      });
      
      // Autofill
      setForm(f => ({
        ...f,
        merchant: forceOverwrite ? translatedMerchant : (f.merchant || translatedMerchant),
        date: forceOverwrite ? (ocrResult.date || f.date) : (f.date === format(new Date(), 'yyyy-MM-dd') && ocrResult.date ? ocrResult.date : f.date),
        currency: forceOverwrite ? (ocrResult.currency || f.currency) : (f.currency === 'USD' && ocrResult.currency ? ocrResult.currency : f.currency),
        amount: forceOverwrite ? (ocrResult.total_amount?.toString() || '') : (f.amount || ocrResult.total_amount?.toString() || ''),
        taxAmount: forceOverwrite ? (ocrResult.tax_amount?.toString() || '') : (f.taxAmount || ocrResult.tax_amount?.toString() || ''),
        description: forceOverwrite ? translatedDescription : (f.description || translatedDescription),
        category: forceOverwrite ? (ocrResult.category || f.category) : (f.category || ocrResult.category),
      }));
      
      if (ocrResult.confidence_score && ocrResult.confidence_score < 60) {
        setOcrWarning("Couldn't read receipt clearly. Please verify the details.");
      } else {
        setOcrSuccess('Receipt processed. Please review before saving.');
      }
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
      setErrors(e => ({ ...e, receipt: 'Please upload a JPG, PNG, or PDF file' }));
      return;
    }
    
    setIsUploading(true);
    setOcrWarning(null);
    setOcrSuccess(null);
    
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, receiptUrl: file_url }));
      setIsUploading(false);
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
    
    const expenseData = {
      employeeId: user.id,
      date: form.date,
      merchant: form.merchant,
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount) || 0,
      currency: form.currency,
      exchangeRate: form.exchangeRate ? parseFloat(form.exchangeRate) : null,
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
      createMutation.mutate(expenseData);
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
            {form.receiptUrl ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Receipt uploaded</span>
                </div>
                {form.receiptUrl.toLowerCase().includes('.pdf') ? (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <Receipt className="h-8 w-8 text-gray-400 mx-auto" />
                    <p className="text-sm text-gray-500 mt-1">PDF Receipt</p>
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
              <label className="cursor-pointer block py-4">
                <input type="file" accept="image/*,.pdf" onChange={handleReceiptUpload} className="hidden" />
                {isUploading || isExtracting ? (
                  <div className="flex flex-col items-center gap-1">
                    <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                    <span className="text-sm text-gray-600">{isExtracting ? 'Reading receipt…' : 'Uploading...'}</span>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-1" />
                    <p className="text-sm text-gray-600 font-medium">Click to upload receipt</p>
                    <p className="text-xs text-gray-400">AI will extract details automatically</p>
                  </>
                )}
              </label>
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

          <div className="space-y-1">
            <Label className="text-xs">Exchange Rate (Optional)</Label>
            <Input
              type="number"
              step="0.0001"
              placeholder="e.g., 1.35"
              value={form.exchangeRate}
              onChange={(e) => setForm(f => ({ ...f, exchangeRate: e.target.value }))}
              className="h-9"
            />
          </div>

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