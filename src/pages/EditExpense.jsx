import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '../utils';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Upload,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Receipt,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CATEGORIES, PAYMENT_METHODS, CURRENCIES, getCategoryLabel } from '../components/shared/CategoryHelpers';
import { logAuditEvent } from '../components/shared/AuditLogger';

export default function EditExpense() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const expenseId = urlParams.get('id');

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: expense, isLoading: expenseLoading } = useQuery({
    queryKey: ['expense', expenseId],
    queryFn: () => base44.entities.Expense.filter({ id: expenseId }).then(r => r[0]),
    enabled: !!expenseId,
  });

  const { data: policies = [] } = useQuery({
    queryKey: ['policies'],
    queryFn: () => base44.entities.Policy.list(),
  });

  const [form, setForm] = useState({
    date: '',
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
  const [ocrConfidence, setOcrConfidence] = useState(null);
  const [ocrWarning, setOcrWarning] = useState(null);
  const [ocrSuccess, setOcrSuccess] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [errors, setErrors] = useState({});

  // Load expense data into form
  useEffect(() => {
    if (expense) {
      setForm({
        date: expense.date || '',
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
    }
  }, [expense]);

  // Process receipt with OCR - handles both images and PDFs
  const processReceiptOCR = async (fileUrl, forceOverwrite = false) => {
    setIsExtracting(true);
    setOcrWarning(null);
    setOcrSuccess(null);
    setOcrConfidence(null);
    
    try {
      const isPdf = fileUrl.toLowerCase().includes('.pdf') || 
                    fileUrl.toLowerCase().includes('application/pdf');
      
      let ocrResult = null;
      let extractionMethod = 'vision';
      
      // For PDFs, first try text extraction
      if (isPdf) {
        try {
          const textExtraction = await base44.integrations.Core.ExtractDataFromUploadedFile({
            file_url: fileUrl,
            json_schema: {
              type: 'object',
              properties: {
                raw_text: { type: 'string', description: 'All text content from the PDF' },
                has_text: { type: 'boolean', description: 'Whether the PDF contains extractable text' }
              }
            }
          });
          
          if (textExtraction.status === 'success' && 
              textExtraction.output?.raw_text && 
              textExtraction.output.raw_text.trim().length > 20) {
            extractionMethod = 'pdf_text';
            
            ocrResult = await base44.integrations.Core.InvokeLLM({
              prompt: `Parse this receipt/invoice text extracted from PDF:

${textExtraction.output.raw_text}

Extract: merchant, date (YYYY-MM-DD), currency, total_amount, tax_amount, items_description, category (from [air_tickets, local_transport, overseas_transport, trip_insurance, communication, entertainment_hospitality, equipment_tools, gifts_souvenirs, other_business, miscellaneous]), detected_language, confidence_score (0-100).`,
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
          }
        } catch (pdfTextError) {
          console.log('PDF text extraction failed:', pdfTextError);
        }
      }
      
      // Fall back to vision OCR
      if (!ocrResult) {
        extractionMethod = isPdf ? 'pdf_vision' : 'vision';
        ocrResult = await base44.integrations.Core.InvokeLLM({
          prompt: `OCR this receipt ${isPdf ? 'PDF (may be scanned)' : 'image'}. Extract: merchant, date (YYYY-MM-DD), currency, total_amount, tax_amount, items_description, category (from [air_tickets, local_transport, overseas_transport, trip_insurance, communication, entertainment_hospitality, equipment_tools, gifts_souvenirs, other_business, miscellaneous]), detected_language, confidence_score (0-100), raw_ocr_text.`,
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
      }
      
      const hasData = ocrResult && (
        ocrResult.merchant || 
        ocrResult.total_amount || 
        (ocrResult.raw_ocr_text && ocrResult.raw_ocr_text.trim().length > 10)
      );
      
      if (!hasData) {
        throw new Error('No meaningful data extracted');
      }
      
      const extractedFieldsOriginal = {
        raw_text: ocrResult.raw_ocr_text,
        language: ocrResult.detected_language,
        confidence: ocrResult.confidence_score,
        merchant: ocrResult.merchant,
        date: ocrResult.date,
        total_amount: ocrResult.total_amount,
        tax_amount: ocrResult.tax_amount,
        currency: ocrResult.currency,
        items: ocrResult.items_description,
        category: ocrResult.category
      };
      
      let translatedData = {
        merchant: ocrResult.merchant || '',
        description: ocrResult.items_description || ''
      };
      
      const needsTranslation = ocrResult.detected_language && 
        !['en', 'eng', 'english'].includes(ocrResult.detected_language.toLowerCase());
      
      if (needsTranslation && (ocrResult.merchant || ocrResult.items_description)) {
        try {
          const translationResult = await base44.integrations.Core.InvokeLLM({
            prompt: `Translate from ${ocrResult.detected_language} to English:
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
          
          translatedData = {
            merchant: translationResult.merchant_english || ocrResult.merchant || '',
            description: translationResult.description_english || ocrResult.items_description || ''
          };
        } catch (translationError) {
          console.error('Translation failed:', translationError);
        }
      }
      
      const extractedFieldsEnglish = {
        merchant: translatedData.merchant,
        description: translatedData.description,
        date: ocrResult.date,
        total_amount: ocrResult.total_amount,
        tax_amount: ocrResult.tax_amount,
        currency: ocrResult.currency,
        category: ocrResult.category,
        source_language: ocrResult.detected_language
      };
      
      setOcrConfidence(ocrResult.confidence_score || 0);
      
      setExtractedData({
        ...ocrResult,
        extractedFieldsOriginal,
        extractedFieldsEnglish,
        translatedMerchant: translatedData.merchant,
        translatedDescription: translatedData.description,
        extractionMethod
      });
      
      const finalMerchant = translatedData.merchant || ocrResult.merchant || '';
      const finalDescription = translatedData.description || ocrResult.items_description || '';
      const finalDate = ocrResult.date || '';
      const finalCurrency = ocrResult.currency || '';
      const finalAmount = ocrResult.total_amount ? ocrResult.total_amount.toString() : '';
      const finalTax = ocrResult.tax_amount ? ocrResult.tax_amount.toString() : '';
      const finalCategory = ocrResult.category || '';
      
      setForm(f => ({
        ...f,
        merchant: forceOverwrite ? finalMerchant : (f.merchant || finalMerchant),
        date: forceOverwrite ? (finalDate || f.date) : (f.date || finalDate),
        currency: forceOverwrite ? (finalCurrency || f.currency) : (f.currency || finalCurrency),
        amount: forceOverwrite ? finalAmount : (f.amount || finalAmount),
        taxAmount: forceOverwrite ? finalTax : (f.taxAmount || finalTax),
        description: forceOverwrite ? finalDescription : (f.description || finalDescription),
        category: forceOverwrite ? (finalCategory || f.category) : (f.category || finalCategory),
      }));
      
      if (ocrResult.confidence_score && ocrResult.confidence_score < 60) {
        setOcrWarning("We couldn't read this receipt clearly. Please fill in the details manually.");
      } else {
        setOcrSuccess('Receipt processed. Please review the values before submitting.');
      }
      
    } catch (error) {
      console.error('Failed to process receipt:', error);
      setOcrWarning("We couldn't read this receipt. Please fill in the details manually.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleReceiptUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const validExtensions = ['jpg', 'jpeg', 'png', 'pdf'];
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      setErrors(e => ({ ...e, receipt: 'Please upload a JPG, PNG, or PDF file' }));
      return;
    }
    
    setIsUploading(true);
    setOcrWarning(null);
    setOcrSuccess(null);
    setOcrConfidence(null);
    
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, receiptUrl: file_url }));
      setIsUploading(false);
      
      await processReceiptOCR(file_url, false);
      
    } catch (error) {
      console.error('Failed to upload receipt:', error);
      setOcrWarning('Failed to upload receipt. Please try again.');
      setIsUploading(false);
      setIsExtracting(false);
    }
  };
  
  const handleReprocessReceipt = async () => {
    if (!form.receiptUrl) return;
    await processReceiptOCR(form.receiptUrl, true);
  };

  const checkPolicies = () => {
    const warnings = [];
    const category = form.category;
    const amount = parseFloat(form.amount) || 0;
    
    const policy = policies.find(p => p.category === category);
    if (policy) {
      if (policy.perTxnLimit && amount > policy.perTxnLimit) {
        warnings.push(`Amount exceeds per-transaction limit of ${policy.perTxnLimit} for ${getCategoryLabel(category)}`);
      }
      if (policy.requiresReceipt && !form.receiptUrl) {
        warnings.push(`Receipt is required for ${getCategoryLabel(category)} expenses`);
      }
    }
    
    return warnings;
  };

  const updateExpenseMutation = useMutation({
    mutationFn: async (expenseData) => {
      const result = await base44.entities.Expense.update(expenseId, expenseData);
      // Recalculate linked report total if applicable
      if (expense?.reportId) {
        const reportExpenses = await base44.entities.Expense.filter({ reportId: expense.reportId });
        const newTotal = reportExpenses.reduce((sum, e) => {
          if (e.id === expenseId) return sum + (expenseData.amount || 0);
          return sum + (e.amount || 0);
        }, 0);
        await base44.entities.Report.update(expense.reportId, { totalAmount: newTotal });
      }
      await logAuditEvent(user, 'expense', expenseId, 'update', expenseData);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense', expenseId] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      // Redirect to trip report if linked, else to MyExpenses
      if (expense?.reportId) {
        navigate(createPageUrl(`TripReportDetails?id=${expense.reportId}`));
      } else {
        navigate(createPageUrl('MyExpenses'));
      }
    },
  });

  const handleSubmit = async (e, submitExpense = false) => {
    e.preventDefault();
    
    const newErrors = {};
    if (!form.merchant) newErrors.merchant = 'Merchant is required';
    if (!form.category) newErrors.category = 'Category is required';
    if (!form.amount) newErrors.amount = 'Amount is required';
    if (!form.date) newErrors.date = 'Date is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    const warnings = checkPolicies();
    
    const expenseData = {
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
      extractedFieldsOriginal: extractedData?.extractedFieldsOriginal || expense?.extractedFieldsOriginal || null,
      extractedFieldsEnglish: extractedData?.extractedFieldsEnglish || expense?.extractedFieldsEnglish || null,
      policyFlags: warnings,
      status: submitExpense ? 'submitted' : 'draft',
    };
    
    updateExpenseMutation.mutate(expenseData);
  };

  if (expenseLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Expense not found.
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  const isReadOnly = expense.status !== 'draft';

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isReadOnly ? 'View Expense' : 'Edit Expense'}
          </h1>
          <p className="text-gray-500">
            {isReadOnly ? 'This expense has been submitted and cannot be edited' : 'Update your expense details'}
          </p>
        </div>
      </div>

      {isReadOnly && (
        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This expense is in "{expense.status}" status and cannot be edited.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        {/* Receipt Upload */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-indigo-600" />
              Receipt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-indigo-300 transition-colors">
              {form.receiptUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Receipt uploaded</span>
                  </div>
                  <img 
                    src={form.receiptUrl} 
                    alt="Receipt" 
                    className="max-h-48 mx-auto rounded-lg shadow-md"
                  />
                  {extractedData && (
                    <div className="mt-3 p-3 bg-indigo-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-indigo-700 text-sm font-medium">
                          <Sparkles className="h-4 w-4" />
                          AI extracted data from receipt
                        </div>
                        {ocrConfidence !== null && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            ocrConfidence >= 80 ? 'bg-green-100 text-green-700' :
                            ocrConfidence >= 60 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {Math.round(ocrConfidence)}% confidence
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {ocrSuccess && (
                    <div className="mt-2 p-2 rounded-lg border bg-green-50 border-green-200">
                      <div className="flex items-center gap-2 text-sm text-green-700">
                        <CheckCircle className="h-4 w-4 flex-shrink-0" />
                        {ocrSuccess}
                      </div>
                    </div>
                  )}
                  {ocrWarning && (
                    <div className="mt-2 p-2 rounded-lg border bg-amber-50 border-amber-200">
                      <div className="flex items-center gap-2 text-sm text-amber-700">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        {ocrWarning}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm"
                      onClick={handleReprocessReceipt}
                      disabled={isExtracting}
                    >
                      {isExtracting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <RotateCcw className="h-4 w-4 mr-1" />
                      )}
                      Re-process Receipt
                    </Button>
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setForm(f => ({ ...f, receiptUrl: '' }));
                        setExtractedData(null);
                        setOcrConfidence(null);
                        setOcrWarning(null);
                        setOcrSuccess(null);
                      }}
                    >
                      Remove & Upload New
                    </Button>
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleReceiptUpload}
                    className="hidden"
                  />
                  {isUploading || isExtracting ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
                      <span className="text-gray-600 font-medium">
                        {isExtracting ? 'Reading receipt…' : 'Uploading...'}
                      </span>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600 font-medium">Click to upload receipt</p>
                      <p className="text-sm text-gray-400 mt-1">AI will automatically extract details</p>
                    </>
                  )}
                </label>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Basic Info */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Expense Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                  className={errors.date ? 'border-red-500' : ''}
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label htmlFor="merchant">Merchant *</Label>
                <Input
                  id="merchant"
                  value={form.merchant}
                  onChange={(e) => setForm(f => ({ ...f, merchant: e.target.value }))}
                  className={errors.merchant ? 'border-red-500' : ''}
                  disabled={isReadOnly}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category *</Label>
                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))} disabled={isReadOnly}>
                  <SelectTrigger className={errors.category ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm(f => ({ ...f, paymentMethod: v }))} disabled={isReadOnly}>
                  <SelectTrigger>
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

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                disabled={isReadOnly}
              />
            </div>
          </CardContent>
        </Card>

        {/* Amount & Currency */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Amount</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                  className={errors.amount ? 'border-red-500' : ''}
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Select value={form.currency} onValueChange={(v) => setForm(f => ({ ...f, currency: v }))} disabled={isReadOnly}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="taxAmount">Tax Amount (Optional)</Label>
                <Input
                  id="taxAmount"
                  type="number"
                  step="0.01"
                  value={form.taxAmount}
                  onChange={(e) => setForm(f => ({ ...f, taxAmount: e.target.value }))}
                  disabled={isReadOnly}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="exchangeRate">Exchange Rate (Optional)</Label>
              <Input
                id="exchangeRate"
                type="number"
                step="0.0001"
                placeholder="e.g., 1.35"
                value={form.exchangeRate}
                onChange={(e) => setForm(f => ({ ...f, exchangeRate: e.target.value }))}
                disabled={isReadOnly}
              />
              <p className="text-xs text-gray-500 mt-1">Enter rate if different from default conversion</p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            {isReadOnly ? 'Back' : 'Cancel'}
          </Button>
          {!isReadOnly && (
            <>
              <Button 
                type="submit" 
                variant="outline"
                disabled={updateExpenseMutation.isPending}
              >
                Save as Draft
              </Button>
              <Button 
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={updateExpenseMutation.isPending}
              >
                {updateExpenseMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save & Submit
              </Button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}