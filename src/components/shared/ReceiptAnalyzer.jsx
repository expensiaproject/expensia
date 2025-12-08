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
    // Step 1: Extract data from receipt using Vision AI with enhanced PDF handling
    const prompt = isPdf 
      ? `You are analyzing a PDF receipt/invoice. PDFs contain structured text that you can read.

  READ THE ENTIRE PDF DOCUMENT and extract:

  1. Merchant/Business Name (usually at top of document)
  2. Transaction Date (convert to YYYY-MM-DD, today is ${new Date().toISOString().split('T')[0]})
  3. Total Amount (look for "Total:", "Amount:", "Grand Total:", "Balance Due:" - just the number)
  4. Tax/VAT (if shown, otherwise 0)
  5. Currency (USD, EUR, SGD, etc. - infer from document)
  6. Items purchased (brief summary)
  7. Category: entertainment_hospitality, local_transport, air_tickets, equipment_tools, gifts_souvenirs, communication, meals, miscellaneous

  IMPORTANT FOR PDF FILES:
  - Read all text carefully from the PDF
  - Look for the final/total amount (not subtotals)
  - Merchant name is usually the largest text at the top
  - ALWAYS return values - never leave merchant, total_amount, or currency empty
  - Make best guesses based on context if something is unclear
  - Extract numbers only for amounts (25.50 not $25.50)`
      : `You are analyzing a receipt image. 

  Extract ALL information:
  1. Merchant name
  2. Date (YYYY-MM-DD)
  3. Total amount (number only)
  4. Tax amount
  5. Currency
  6. Items description
  7. Category
  8. Language

  ALWAYS provide merchant, total_amount, and currency - make educated guesses if needed.`;

    ocrResult = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
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