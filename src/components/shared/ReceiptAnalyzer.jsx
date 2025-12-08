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
  console.log('File type detected:', isPdf ? 'PDF' : 'Image');
  
  let ocrResult;
  
  try {
    // Step 1: Extract data from receipt using Vision AI
    ocrResult = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert receipt and invoice OCR system. Carefully analyze this ${isPdf ? 'PDF receipt document' : 'receipt image'}.

${isPdf ? 'NOTE: This is a PDF file. Read all pages if multi-page. Extract text and numbers from the document.' : 'NOTE: This is an image file. Analyze all visible text and numbers.'}

IMPORTANT: Extract ALL visible information from this receipt/invoice/bill:

1. **merchant**: The store, restaurant, company, or business name (usually prominent at the top)
2. **date**: Transaction date - convert to YYYY-MM-DD format. Today is 2025-12-02 for reference.
3. **total_amount**: The final total/amount paid (just the number, no currency symbol). Look for "Total", "Grand Total", "Amount Due", or the final/largest amount.
4. **tax_amount**: Tax/VAT/GST amount if shown (number only), use 0 if not visible
5. **currency**: 3-letter currency code (USD, SGD, EUR, JPY, KRW, CNY, THB, MYR, IDR, PHP, VND, TWD, HKD, AUD, GBP, etc.) - infer from country/symbols/text
6. **items_description**: Brief description of what was purchased
7. **category**: Classify as one of: entertainment_hospitality, local_transport, air_tickets, equipment_tools, gifts_souvenirs, communication, miscellaneous
8. **detected_language**: Primary language (en, zh, ja, ko, id, th, ms, vi, etc.)
9. **confidence_score**: Your confidence level 0-100

CRITICAL INSTRUCTIONS:
- ALWAYS provide values for merchant, total_amount, and currency - make your best guess
- If text is blurry or unclear, still provide your best interpretation
- For amounts, extract just the number (e.g., 25.50 not $25.50)
- Never return null or empty strings - always guess based on context`,
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
  const hasDate = ocrResult.date && ocrResult.date.length > 0 && ocrResult.date !== 'null' && ocrResult.date !== 'N/A' && ocrResult.date !== 'undefined';
  const hasMerchant = ocrResult.merchant && ocrResult.merchant.length > 0 && ocrResult.merchant !== 'null' && ocrResult.merchant !== 'N/A' && ocrResult.merchant !== 'Unknown';
  const hasAmount = ocrResult.total_amount !== null && ocrResult.total_amount !== undefined && !isNaN(ocrResult.total_amount) && ocrResult.total_amount > 0;
  const hasCurrency = ocrResult.currency && ocrResult.currency.length > 0 && ocrResult.currency !== 'null';
  const hasDescription = ocrResult.items_description && ocrResult.items_description.length > 0 && ocrResult.items_description !== 'null';
  const hasCategory = ocrResult.category && ocrResult.category.length > 0 && ocrResult.category !== 'null';
  
  // Success if we have at least merchant OR amount - be very lenient
  const hasAnyData = hasMerchant || hasAmount;
  
  // Even if hasAnyData is false, still return partial data instead of failing completely
  if (!hasAnyData && !hasDate && !hasDescription) {
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