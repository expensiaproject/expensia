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
  Sparkles
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

export default function NewExpense() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.filter({ active: true }),
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
    originalCurrency: 'USD',
    originalAmount: '',
    baseCurrency: 'USD',
    amountInBase: '',
    fxSource: 'no_fx',
    fxRate: '',
    fxFeeAmount: '',
    fxNotes: '',
    taxAmount: '',
    paymentMethod: 'personal_card',
    projectId: '',
    costCenter: user?.costCenter || '',
    receiptUrl: '',
  });

  const [receiptFile, setReceiptFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [ocrConfidence, setOcrConfidence] = useState(null);
  const [ocrWarning, setOcrWarning] = useState(null);
  const [policyWarnings, setPolicyWarnings] = useState([]);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [errors, setErrors] = useState({});

  // Update cost center when user loads
  useEffect(() => {
    if (user?.costCenter && !form.costCenter) {
      setForm(f => ({ ...f, costCenter: user.costCenter }));
    }
  }, [user]);

  // Calculate FX when relevant fields change
  useEffect(() => {
    const { paymentMethod, originalAmount, amountInBase, fxRate, originalCurrency, baseCurrency } = form;
    
    if (paymentMethod === 'cash_local') {
      setForm(f => ({
        ...f,
        fxSource: 'no_fx',
        fxRate: '',
        amountInBase: originalAmount
      }));
    } else if (paymentMethod === 'personal_card' || paymentMethod === 'corporate_card') {
      setForm(f => ({ ...f, fxSource: 'card' }));
      // Auto-calculate FX rate if both amounts provided
      if (originalAmount && amountInBase && parseFloat(originalAmount) > 0) {
        const calculatedRate = parseFloat(amountInBase) / parseFloat(originalAmount);
        setForm(f => ({ ...f, fxRate: calculatedRate.toFixed(6) }));
      }
    } else if (paymentMethod === 'cash_foreign') {
      setForm(f => ({ ...f, fxSource: 'cash_manual' }));
      // Auto-calculate base amount if rate provided
      if (originalAmount && fxRate) {
        const calculated = parseFloat(originalAmount) * parseFloat(fxRate);
        setForm(f => ({ ...f, amountInBase: calculated.toFixed(2) }));
      }
    }
  }, [form.paymentMethod, form.originalAmount, form.amountInBase, form.fxRate]);

  const handleReceiptUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const validExtensions = ['jpg', 'jpeg', 'png', 'pdf'];
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      setErrors(e => ({ ...e, receipt: 'Please upload a JPG, PNG, or PDF file' }));
      return;
    }
    
    setReceiptFile(file);
    setIsUploading(true);
    setOcrWarning(null);
    setOcrConfidence(null);
    
    try {
      // Step 1: Upload the file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, receiptUrl: file_url }));
      
      // Step 2: Automatic OCR processing
      setIsExtracting(true);
      
      // Step 2a: Extract raw OCR text and structured data
      const ocrResult = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an OCR engine processing a receipt image. Perform these tasks:

1. EXTRACT ALL TEXT from the receipt exactly as it appears (raw OCR output)
2. DETECT the language of the receipt
3. PARSE structured fields from the text
4. ESTIMATE your confidence (0-100%) based on image quality and text clarity

Extract these structured fields:
- merchant: vendor/store name
- date: transaction date (format as YYYY-MM-DD)
- currency: currency code (USD, EUR, JPY, CNY, SGD, etc.)
- total_amount: final total amount (number only)
- tax_amount: tax/VAT amount if visible (number only)
- items_description: brief summary of purchased items
- category: best match from [air_tickets, local_transport, overseas_transport, trip_insurance, communication, entertainment_hospitality, equipment_tools, gifts_souvenirs, other_business, miscellaneous]

Provide:
- raw_ocr_text: all text exactly as read from receipt
- detected_language: language code (en, ja, zh, ko, etc.)
- confidence_score: your confidence percentage (0-100)`,
        file_urls: file_url,
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
      
      // Step 3: Save raw OCR to extractedFieldsOriginal
      const extractedFieldsOriginal = {
        raw_text: ocrResult.raw_ocr_text,
        language: ocrResult.detected_language,
        confidence: ocrResult.confidence_score,
        merchant_original: ocrResult.merchant,
        items_original: ocrResult.items_description
      };
      
      // Step 4: Translate if not English
      let translatedData = {
        merchant: ocrResult.merchant,
        description: ocrResult.items_description,
        language: 'English'
      };
      
      const needsTranslation = ocrResult.detected_language && 
        !['en', 'eng', 'english'].includes(ocrResult.detected_language.toLowerCase());
      
      if (needsTranslation && (ocrResult.merchant || ocrResult.items_description)) {
        const translationResult = await base44.integrations.Core.InvokeLLM({
          prompt: `Translate the following receipt information from ${ocrResult.detected_language} to English. Preserve the meaning and context.

Merchant name: ${ocrResult.merchant || 'N/A'}
Items/Description: ${ocrResult.items_description || 'N/A'}
Raw text excerpt: ${(ocrResult.raw_ocr_text || '').substring(0, 500)}

Provide natural English translations:`,
          response_json_schema: {
            type: 'object',
            properties: {
              merchant_english: { type: 'string' },
              description_english: { type: 'string' },
              translation_notes: { type: 'string' }
            }
          }
        });
        
        translatedData = {
          merchant: translationResult.merchant_english || ocrResult.merchant,
          description: translationResult.description_english || ocrResult.items_description,
          notes: translationResult.translation_notes,
          source_language: ocrResult.detected_language
        };
      }
      
      // Step 5: Save translation to extractedFieldsEnglish
      const extractedFieldsEnglish = {
        merchant: translatedData.merchant,
        description: translatedData.description,
        source_language: ocrResult.detected_language,
        translation_notes: translatedData.notes
      };
      
      // Step 6: Set confidence and warning
      setOcrConfidence(ocrResult.confidence_score);
      if (ocrResult.confidence_score && ocrResult.confidence_score < 60) {
        setOcrWarning('Some receipt values may be incomplete. Please review before submitting.');
      }
      
      // Step 7: Store full extraction data
      setExtractedData({
        ...ocrResult,
        extractedFieldsOriginal,
        extractedFieldsEnglish,
        translatedMerchant: translatedData.merchant,
        translatedDescription: translatedData.description
      });
      
      // Step 8: Autofill form fields with translated values
      setForm(f => ({
        ...f,
        merchant: translatedData.merchant || ocrResult.merchant || f.merchant,
        date: ocrResult.date || f.date,
        originalCurrency: ocrResult.currency || f.originalCurrency,
        originalAmount: ocrResult.total_amount?.toString() || f.originalAmount,
        taxAmount: ocrResult.tax_amount?.toString() || f.taxAmount,
        description: translatedData.description || ocrResult.items_description || f.description,
        category: ocrResult.category || f.category,
      }));
      
    } catch (error) {
      console.error('Failed to process receipt:', error);
      setOcrWarning('OCR processing failed. Please enter details manually.');
    } finally {
      setIsUploading(false);
      setIsExtracting(false);
    }
  };

  const checkPolicies = () => {
    const warnings = [];
    const category = form.category;
    const amount = parseFloat(form.amountInBase) || 0;
    
    const policy = policies.find(p => p.category === category);
    if (policy) {
      if (policy.perTxnLimitBase && amount > policy.perTxnLimitBase) {
        warnings.push(`Amount exceeds per-transaction limit of ${policy.perTxnLimitBase} for ${getCategoryLabel(category)}`);
      }
      if (policy.requiresReceipt && !form.receiptUrl) {
        warnings.push(`Receipt is required for ${getCategoryLabel(category)} expenses`);
      }
    }
    
    return warnings;
  };

  const checkDuplicates = async () => {
    if (!user?.id || !form.merchant || !form.originalAmount) return null;
    
    const existingExpenses = await base44.entities.Expense.filter({
      employeeId: user.id,
      merchant: form.merchant
    });
    
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const formDate = new Date(form.date).getTime();
    const formAmount = parseFloat(form.originalAmount);
    
    const duplicate = existingExpenses.find(exp => {
      const expDate = new Date(exp.date).getTime();
      const dateDiff = Math.abs(formDate - expDate);
      const amountDiff = Math.abs((exp.originalAmount || 0) - formAmount);
      return dateDiff <= sevenDaysMs && amountDiff < formAmount * 0.1; // within 10%
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
    
    // Validate
    const newErrors = {};
    if (!form.merchant) newErrors.merchant = 'Merchant is required';
    if (!form.category) newErrors.category = 'Category is required';
    if (!form.originalAmount) newErrors.originalAmount = 'Amount is required';
    if (!form.date) newErrors.date = 'Date is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    // Check policies and duplicates
    const warnings = checkPolicies();
    const duplicate = await checkDuplicates();
    
    const expenseData = {
      employeeId: user.id,
      date: form.date,
      merchant: form.merchant,
      category: form.category,
      description: form.description,
      originalCurrency: form.originalCurrency,
      originalAmount: parseFloat(form.originalAmount) || 0,
      baseCurrency: form.baseCurrency,
      amountInBase: parseFloat(form.amountInBase) || parseFloat(form.originalAmount) || 0,
      fxSource: form.fxSource,
      fxRate: form.fxRate ? parseFloat(form.fxRate) : null,
      fxFeeAmount: form.fxFeeAmount ? parseFloat(form.fxFeeAmount) : null,
      fxNotes: form.fxNotes,
      taxAmount: form.taxAmount ? parseFloat(form.taxAmount) : null,
      paymentMethod: form.paymentMethod,
      projectId: form.projectId || null,
      costCenter: form.costCenter,
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
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Expense</h1>
          <p className="text-gray-500">Add a new expense to your records</p>
        </div>
      </div>

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
                        {ocrConfidence && (
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
                          Detected language: {extractedData.detected_language} (translated to English)
                        </p>
                      )}
                    </div>
                  )}
                  {ocrWarning && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-2 text-amber-700 text-sm">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        {ocrWarning}
                      </div>
                    </div>
                  )}
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setForm(f => ({ ...f, receiptUrl: '' }));
                      setExtractedData(null);
                      setReceiptFile(null);
                      setOcrConfidence(null);
                      setOcrWarning(null);
                    }}
                  >
                    Remove & Upload New
                  </Button>
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
                      <span className="text-gray-600">
                        {isExtracting ? 'Extracting data with AI...' : 'Uploading...'}
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
                />
                {errors.date && <p className="text-sm text-red-500 mt-1">{errors.date}</p>}
              </div>
              <div>
                <Label htmlFor="merchant">Merchant *</Label>
                <Input
                  id="merchant"
                  placeholder="e.g., Singapore Airlines"
                  value={form.merchant}
                  onChange={(e) => setForm(f => ({ ...f, merchant: e.target.value }))}
                  className={errors.merchant ? 'border-red-500' : ''}
                />
                {errors.merchant && <p className="text-sm text-red-500 mt-1">{errors.merchant}</p>}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
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
                {errors.category && <p className="text-sm text-red-500 mt-1">{errors.category}</p>}
              </div>
              <div>
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

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add any notes or details..."
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Amount & Currency */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Amount & Currency</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="originalCurrency">Original Currency</Label>
                <Select value={form.originalCurrency} onValueChange={(v) => setForm(f => ({ ...f, originalCurrency: v }))}>
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
                <Label htmlFor="originalAmount">Original Amount *</Label>
                <Input
                  id="originalAmount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.originalAmount}
                  onChange={(e) => setForm(f => ({ ...f, originalAmount: e.target.value }))}
                  className={errors.originalAmount ? 'border-red-500' : ''}
                />
                {errors.originalAmount && <p className="text-sm text-red-500 mt-1">{errors.originalAmount}</p>}
              </div>
              <div>
                <Label htmlFor="taxAmount">Tax Amount</Label>
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

            {/* FX Section - show if not local cash */}
            {form.paymentMethod !== 'cash_local' && (
              <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                <h4 className="font-medium text-gray-700">Foreign Exchange Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="baseCurrency">Base Currency</Label>
                    <Select value={form.baseCurrency} onValueChange={(v) => setForm(f => ({ ...f, baseCurrency: v }))}>
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
                  
                  {(form.paymentMethod === 'personal_card' || form.paymentMethod === 'corporate_card') && (
                    <div>
                      <Label htmlFor="amountInBase">Amount Charged (Base)</Label>
                      <Input
                        id="amountInBase"
                        type="number"
                        step="0.01"
                        placeholder="Amount on card statement"
                        value={form.amountInBase}
                        onChange={(e) => setForm(f => ({ ...f, amountInBase: e.target.value }))}
                      />
                      <p className="text-xs text-gray-500 mt-1">Enter amount from your card statement</p>
                    </div>
                  )}
                  
                  {form.paymentMethod === 'cash_foreign' && (
                    <div>
                      <Label htmlFor="fxRate">Exchange Rate</Label>
                      <Input
                        id="fxRate"
                        type="number"
                        step="0.000001"
                        placeholder="e.g., 1.35"
                        value={form.fxRate}
                        onChange={(e) => setForm(f => ({ ...f, fxRate: e.target.value }))}
                      />
                      <p className="text-xs text-gray-500 mt-1">{form.originalCurrency} to {form.baseCurrency}</p>
                    </div>
                  )}
                  
                  <div>
                    <Label htmlFor="fxFeeAmount">FX Fee (Optional)</Label>
                    <Input
                      id="fxFeeAmount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={form.fxFeeAmount}
                      onChange={(e) => setForm(f => ({ ...f, fxFeeAmount: e.target.value }))}
                    />
                  </div>
                </div>
                
                {form.fxRate && (
                  <div className="text-sm text-gray-600">
                    Calculated: {form.originalAmount || 0} {form.originalCurrency} × {form.fxRate} = {form.amountInBase || 0} {form.baseCurrency}
                  </div>
                )}
                
                <div>
                  <Label htmlFor="fxNotes">FX Notes</Label>
                  <Input
                    id="fxNotes"
                    placeholder="e.g., Rate from money changer at airport"
                    value={form.fxNotes}
                    onChange={(e) => setForm(f => ({ ...f, fxNotes: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Project & Cost Center */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Allocation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="projectId">Project (Optional)</Label>
                <Select value={form.projectId} onValueChange={(v) => setForm(f => ({ ...f, projectId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>No Project</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="costCenter">Cost Center</Label>
                <Input
                  id="costCenter"
                  placeholder="e.g., DEPT-001"
                  value={form.costCenter}
                  onChange={(e) => setForm(f => ({ ...f, costCenter: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

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
        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="outline"
            disabled={createExpenseMutation.isPending}
          >
            Save as Draft
          </Button>
          <Button 
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            className="bg-indigo-600 hover:bg-indigo-700"
            disabled={createExpenseMutation.isPending}
          >
            {createExpenseMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Save & Submit
          </Button>
        </div>
      </form>
    </div>
  );
}