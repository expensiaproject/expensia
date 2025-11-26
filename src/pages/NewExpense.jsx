import React, { useState } from 'react';
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
import { FormSection, PrimaryButton, SecondaryButton } from '../components/shared/UIHelpers';

export default function NewExpense() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
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
  const [policyWarnings, setPolicyWarnings] = useState([]);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [errors, setErrors] = useState({});

  // Process receipt with OCR - handles both images and PDFs
  const processReceiptOCR = async (fileUrl, forceOverwrite = false) => {
    setIsExtracting(true);
    setOcrWarning(null);
    setOcrSuccess(null);
    setOcrConfidence(null);
    
    try {
      // Detect if this is a PDF file
      const isPdf = fileUrl.toLowerCase().includes('.pdf') || 
                    fileUrl.toLowerCase().includes('application/pdf');
      
      let ocrResult = null;
      let extractionMethod = 'vision';
      
      if (isPdf) {
        // For PDFs, first try to extract text directly (for text-based PDFs)
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
          
          // If we got meaningful text from PDF extraction
          if (textExtraction.status === 'success' && 
              textExtraction.output?.raw_text && 
              textExtraction.output.raw_text.trim().length > 20) {
            extractionMethod = 'pdf_text';
            
            // Parse the extracted text with LLM
            ocrResult = await base44.integrations.Core.InvokeLLM({
              prompt: `You are parsing receipt/invoice text that was extracted from a PDF. Analyze this text and extract structured data.

EXTRACTED TEXT FROM PDF:
${textExtraction.output.raw_text}

Extract these fields:
- merchant: vendor/store name
- date: transaction date (format as YYYY-MM-DD)
- currency: currency code (USD, EUR, JPY, CNY, SGD, IDR, etc.)
- total_amount: final total amount (number only)
- tax_amount: tax/VAT amount if visible (number only)
- items_description: brief summary of items/services
- category: best match from [air_tickets, local_transport, overseas_transport, trip_insurance, communication, entertainment_hospitality, equipment_tools, gifts_souvenirs, other_business, miscellaneous]
- detected_language: language code of the text (en, ja, zh, ko, id, etc.)
- confidence_score: your confidence in the extraction (0-100)

Return the raw_ocr_text as the original extracted text.`,
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
          console.log('PDF text extraction failed, will try vision OCR:', pdfTextError);
        }
      }
      
      // If we don't have results yet (image file, or PDF text extraction failed/insufficient)
      // Use vision-based OCR
      if (!ocrResult) {
        extractionMethod = isPdf ? 'pdf_vision' : 'vision';
        ocrResult = await base44.integrations.Core.InvokeLLM({
          prompt: `You are an OCR engine processing a receipt ${isPdf ? 'PDF document' : 'image'}. Perform these tasks:

1. EXTRACT ALL TEXT from the ${isPdf ? 'document pages' : 'receipt'} exactly as it appears
2. DETECT the language of the receipt
3. PARSE structured fields from the text
4. ESTIMATE your confidence (0-100%) based on ${isPdf ? 'document' : 'image'} quality and text clarity

${isPdf ? 'Note: This PDF may contain scanned images of receipts. Carefully OCR all visible text from each page.' : ''}

Extract these structured fields:
- merchant: vendor/store name
- date: transaction date (format as YYYY-MM-DD if possible)
- currency: currency code (USD, EUR, JPY, CNY, SGD, IDR, etc.)
- total_amount: final total amount (number only, no currency symbol)
- tax_amount: tax/VAT amount if visible (number only)
- items_description: brief summary of purchased items
- category: best match from [air_tickets, local_transport, overseas_transport, trip_insurance, communication, entertainment_hospitality, equipment_tools, gifts_souvenirs, other_business, miscellaneous]

Provide:
- raw_ocr_text: all text exactly as read from receipt
- detected_language: language code (en, ja, zh, ko, id, etc.)
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
      }
      
      // Check if we got any meaningful data
      const hasData = ocrResult && (
        ocrResult.merchant || 
        ocrResult.total_amount || 
        (ocrResult.raw_ocr_text && ocrResult.raw_ocr_text.trim().length > 10)
      );
      
      if (!hasData) {
        throw new Error('No meaningful data extracted from receipt');
      }
      
      // Save raw OCR to extractedFieldsOriginal
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
      
      // Translate if not English
      let translatedData = {
        merchant: ocrResult.merchant || '',
        description: ocrResult.items_description || ''
      };
      
      const needsTranslation = ocrResult.detected_language && 
        !['en', 'eng', 'english'].includes(ocrResult.detected_language.toLowerCase());
      
      if (needsTranslation && (ocrResult.merchant || ocrResult.items_description)) {
        try {
          const translationResult = await base44.integrations.Core.InvokeLLM({
            prompt: `Translate the following receipt information from ${ocrResult.detected_language} to English:

Merchant name: ${ocrResult.merchant || 'N/A'}
Items/Description: ${ocrResult.items_description || 'N/A'}

Provide natural English translations:`,
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
      
      // Save translation to extractedFieldsEnglish
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
      
      // Autofill form fields
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
        date: forceOverwrite ? (finalDate || f.date) : (f.date === format(new Date(), 'yyyy-MM-dd') && finalDate ? finalDate : f.date),
        currency: forceOverwrite ? (finalCurrency || f.currency) : (f.currency === 'USD' && finalCurrency ? finalCurrency : f.currency),
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

  const checkDuplicates = async () => {
    if (!user?.id || !form.merchant || !form.amount) return null;
    
    const existingExpenses = await base44.entities.Expense.filter({
      employeeId: user.id,
      merchant: form.merchant
    });
    
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const formDate = new Date(form.date).getTime();
    const formAmount = parseFloat(form.amount);
    
    const duplicate = existingExpenses.find(exp => {
      const expDate = new Date(exp.date).getTime();
      const dateDiff = Math.abs(formDate - expDate);
      const amountDiff = Math.abs((exp.amount || 0) - formAmount);
      return dateDiff <= sevenDaysMs && amountDiff < formAmount * 0.1;
    });
    
    return duplicate;
  };

  const createExpenseMutation = useMutation({
    mutationFn: async (expenseData) => {
      const result = await base44.entities.Expense.create(expenseData);
      await logAuditEvent(user, 'expense', result.id, 'create', null, { status: 'draft' });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myExpenses'] });
      navigate(createPageUrl('MyExpenses'));
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
    const duplicate = await checkDuplicates();
    
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
      policyFlags: warnings,
      status: submitExpense ? 'submitted' : 'draft',
      duplicateOf: duplicate?.id || null,
    };
    
    createExpenseMutation.mutate(expenseData);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-md">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">New Expense</h1>
          <p className="text-sm text-gray-500">Add a new expense to your records</p>
        </div>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        {/* Receipt Upload */}
        <FormSection icon={Receipt} title="Receipt Upload">
          <div>
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
                      {extractedData.detected_language && 
                       !['en', 'eng', 'english'].includes(extractedData.detected_language.toLowerCase()) && (
                        <p className="text-xs text-indigo-600 mt-1">
                          Detected: {extractedData.detected_language} (translated to English)
                        </p>
                      )}
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
                      <span className="text-sm text-gray-400">
                        {isExtracting ? 'AI is extracting expense details' : 'Please wait'}
                      </span>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600 font-medium">Click to upload receipt</p>
                      <p className="text-sm text-gray-400 mt-1">AI will automatically extract expense details</p>
                    </>
                  )}
                </label>
              )}
            </div>
          </div>
        </FormSection>

        {/* Expense Details */}
        <FormSection title="Expense Details">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                  className={errors.date ? 'border-red-500' : ''}
                />
                {errors.date && <p className="text-sm text-red-500">{errors.date}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="merchant">Merchant *</Label>
                <Input
                  id="merchant"
                  placeholder="e.g., Singapore Airlines"
                  value={form.merchant}
                  onChange={(e) => setForm(f => ({ ...f, merchant: e.target.value }))}
                  className={errors.merchant ? 'border-red-500' : ''}
                />
                {errors.merchant && <p className="text-sm text-red-500">{errors.merchant}</p>}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="category">Category *</Label>
                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className={errors.category ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div>
                          <div className="font-medium">{cat.label}</div>
                          <div className="text-xs text-gray-500">{cat.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-sm text-red-500">{errors.category}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm(f => ({ ...f, paymentMethod: v }))}>
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

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add any notes or details..."
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
        </FormSection>

        {/* Amount Section */}
        <FormSection title="Amount">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                  className={errors.amount ? 'border-red-500' : ''}
                />
                {errors.amount && <p className="text-sm text-red-500">{errors.amount}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currency">Currency</Label>
                <Select value={form.currency} onValueChange={(v) => setForm(f => ({ ...f, currency: v }))}>
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
              <div className="space-y-1.5">
                <Label htmlFor="taxAmount">Tax Amount (Optional)</Label>
                <Input
                  id="taxAmount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.taxAmount}
                  onChange={(e) => setForm(f => ({ ...f, taxAmount: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exchangeRate">Exchange Rate (Optional)</Label>
              <Input
                id="exchangeRate"
                type="number"
                step="0.0001"
                placeholder="e.g., 1.35 (1 USD = 1.35 SGD)"
                value={form.exchangeRate}
                onChange={(e) => setForm(f => ({ ...f, exchangeRate: e.target.value }))}
              />
              <p className="text-xs text-gray-500">Enter rate if different from default conversion</p>
            </div>
          </div>
        </FormSection>

        {/* Warnings */}
        {policyWarnings.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside">
                {policyWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {duplicateWarning && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Possible duplicate: You have a similar expense for {duplicateWarning.merchant} 
              on {format(new Date(duplicateWarning.date), 'MMM d, yyyy')}
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4 border-t border-gray-100">
          <SecondaryButton type="button" onClick={() => navigate(-1)}>
            Cancel
          </SecondaryButton>
          <Button 
            type="submit" 
            variant="outline"
            disabled={createExpenseMutation.isPending}
            className="rounded-md font-medium h-10 px-5 w-full sm:w-[180px]"
          >
            Save as Draft
          </Button>
          <PrimaryButton 
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            disabled={createExpenseMutation.isPending}
          >
            {createExpenseMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Save & Submit
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}