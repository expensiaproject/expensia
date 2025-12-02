import { base44 } from '@/api/base44Client';

/**
 * Analyzes a receipt image or PDF using AI Vision + LLM
 * Supports Korean, Japanese, Chinese, Indonesian, and English receipts
 * 
 * @param {string} fileUrl - URL of the uploaded receipt file
 * @returns {Promise<Object>} Extracted receipt data
 */
export async function analyzeReceipt(fileUrl) {
  if (!fileUrl) {
    return {
      success: false,
      error: "No file URL provided.",
      data: null
    };
  }

  const isPdf = fileUrl.toLowerCase().includes('.pdf') || fileUrl.toLowerCase().includes('application/pdf');
  
  let ocrResult;
  
  try {
    // Step 1: Extract data from receipt using Vision AI
    ocrResult = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert receipt OCR system. Analyze this ${isPdf ? 'PDF document' : 'image'} carefully.

This is a photo of a receipt/invoice. Extract ALL information you can see:

1. **merchant**: Store/business name (usually at top of receipt, in header or logo area)
2. **date**: Transaction date in YYYY-MM-DD format (look for dates like 02/12/2025, Dec 2 2025, 2025-12-02, etc.)
3. **total_amount**: Final total amount (number only, look for "Total", "TOTAL", "Amount", "Grand Total", or the largest number at bottom)
4. **tax_amount**: Tax/VAT/GST if shown (number only, 0 if not visible)
5. **currency**: Currency code (SGD for Singapore, USD, EUR, JPY, KRW, IDR, THB, MYR, etc.) - infer from location/symbols
6. **items_description**: What was purchased (brief list of items)
7. **category**: One of: entertainment_hospitality (food/restaurants), local_transport, air_tickets, equipment_tools, gifts_souvenirs, communication, miscellaneous
8. **detected_language**: Language code (en, zh, ja, ko, id, th, ms, vi)
9. **confidence_score**: Your confidence 0-100

CRITICAL: Even for blurry/unclear images, provide your BEST GUESS for each field. Do not leave fields empty - use reasonable estimates based on what you can see.`,
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
    
    console.log('Raw OCR result:', ocrResult);
  } catch (error) {
    console.error('OCR API call failed:', error);
    return {
      success: false,
      error: "Couldn't read this receipt. Please fill in manually.",
      data: null
    };
  }

  // If ocrResult is null/undefined, fail
  if (!ocrResult) {
    return {
      success: false,
      error: "Couldn't read this receipt. Please fill in manually.",
      data: null
    };
  }

  // Check if we got any core data - be very lenient
  const hasDate = ocrResult.date && ocrResult.date.length > 0 && ocrResult.date !== 'null' && ocrResult.date !== 'N/A';
  const hasMerchant = ocrResult.merchant && ocrResult.merchant.length > 0 && ocrResult.merchant !== 'null' && ocrResult.merchant !== 'N/A';
  const hasAmount = ocrResult.total_amount !== null && ocrResult.total_amount !== undefined && !isNaN(ocrResult.total_amount);
  const hasCurrency = ocrResult.currency && ocrResult.currency.length > 0 && ocrResult.currency !== 'null';
  const hasDescription = ocrResult.items_description && ocrResult.items_description.length > 0;
  const hasCategory = ocrResult.category && ocrResult.category.length > 0;
  
  // Success if ANY useful data was extracted
  const hasAnyData = hasDate || hasMerchant || hasAmount || hasCurrency || hasDescription || hasCategory;
  
  if (!hasAnyData) {
    return {
      success: false,
      error: "Couldn't read this receipt. Please fill in manually.",
      data: null
    };
  }

  // Step 2: Translate if not English
  let translatedMerchant = ocrResult.merchant || '';
  let translatedDescription = ocrResult.items_description || '';
  
  const needsTranslation = ocrResult.detected_language && 
    !['en', 'eng', 'english'].includes(ocrResult.detected_language.toLowerCase());
  
  if (needsTranslation && (ocrResult.merchant || ocrResult.items_description)) {
    try {
      const translationResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Translate the following to English. Keep brand names, store names, and proper nouns as-is (don't translate them):

Merchant name: ${ocrResult.merchant || 'N/A'}
Items/Description: ${ocrResult.items_description || 'N/A'}`,
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
      console.error('Translation failed, using original values:', e);
    }
  }

  return {
    success: true,
    data: {
      date: ocrResult.date || null,
      merchant: translatedMerchant,
      merchantOriginal: ocrResult.merchant || '',
      amount: ocrResult.total_amount || null,
      taxAmount: ocrResult.tax_amount || null,
      currency: ocrResult.currency || null,
      description: translatedDescription,
      descriptionOriginal: ocrResult.items_description || '',
      category: ocrResult.category || null,
      language: ocrResult.detected_language || null,
      confidence: ocrResult.confidence_score || 0,
      rawText: ocrResult.raw_ocr_text || ''
    }
  };
}

export default analyzeReceipt;