import { base44 } from '@/api/base44Client';

/**
 * Analyzes a receipt image or PDF using AI Vision + LLM
 * Supports Korean, Japanese, Chinese, Indonesian, and English receipts
 * 
 * @param {string} fileUrl - URL of the uploaded receipt file
 * @returns {Promise<Object>} Extracted receipt data
 */
export async function analyzeReceipt(fileUrl) {
  const isPdf = fileUrl.toLowerCase().includes('.pdf') || fileUrl.toLowerCase().includes('application/pdf');
  
  let ocrResult;
  
  try {
    // Step 1: Extract data from receipt using Vision AI
    ocrResult = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert receipt OCR system. Carefully analyze this ${isPdf ? 'PDF document' : 'image'} of a receipt.

The receipt may be in ANY language including English, Korean, Japanese, Chinese, Indonesian, Thai, Vietnamese, Malay, or any other language.

Look at the image very carefully and EXTRACT ALL visible information:

1. **merchant**: The store/vendor/business name - look at the top of the receipt for the company name, logo text, or header
2. **date**: Transaction date - look for date formats like DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, or written dates. Convert to YYYY-MM-DD format.
3. **total_amount**: The FINAL TOTAL amount paid (number only, no currency symbols)
   - Look for keywords: "Total", "Grand Total", "Amount Due", "TOTAL", "Subtotal", "合計", "총액", "Jumlah", "รวม", "Tổng", "Amt", etc.
   - Usually the largest/bold number at the bottom
4. **tax_amount**: Tax/VAT/GST amount if shown (number only, can be 0 if not visible)
5. **currency**: Currency code based on receipt origin or currency symbols (USD, EUR, JPY, CNY, KRW, SGD, IDR, THB, VND, MYR, TWD, HKD, GBP, AUD, etc.)
6. **items_description**: Brief summary of what was purchased (list main items)
7. **category**: Best match from: air_tickets, local_transport, overseas_transport, trip_insurance, communication, entertainment_hospitality, equipment_tools, gifts_souvenirs, other_business, miscellaneous
8. **detected_language**: ISO language code (en, ko, ja, zh, id, th, vi, ms, etc.)
9. **confidence_score**: Your confidence in the extraction (0-100)

IMPORTANT: Even if the image is blurry or partially visible, try your best to extract whatever you can see. Return your best guess for each field.`,
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
  } catch (error) {
    console.error('OCR API call failed:', error);
    return {
      success: false,
      error: "Couldn't read this receipt. Please fill in manually.",
      data: null
    };
  }

  // Check if we got any core data - be more lenient
  const hasDate = ocrResult?.date && ocrResult.date.length > 0 && ocrResult.date !== 'null';
  const hasMerchant = ocrResult?.merchant && ocrResult.merchant.length > 0 && ocrResult.merchant !== 'null';
  const hasAmount = ocrResult?.total_amount !== null && ocrResult?.total_amount !== undefined && ocrResult.total_amount >= 0;
  const hasCurrency = ocrResult?.currency && ocrResult.currency.length > 0;
  const hasDescription = ocrResult?.items_description && ocrResult.items_description.length > 0;
  
  // Success if ANY useful data was extracted
  if (!hasDate && !hasMerchant && !hasAmount && !hasCurrency && !hasDescription) {
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