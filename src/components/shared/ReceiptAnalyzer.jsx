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
  
  // Step 1: Extract data from receipt using Vision AI
  const ocrResult = await base44.integrations.Core.InvokeLLM({
    prompt: `You are an expert receipt OCR system. Analyze this ${isPdf ? 'PDF document' : 'image'} of a receipt.

The receipt may be in ANY language including:
- English
- Korean (한국어)
- Japanese (日本語)
- Chinese (中文 - Simplified or Traditional)
- Indonesian (Bahasa Indonesia)
- Thai (ภาษาไทย)
- Vietnamese (Tiếng Việt)
- Malay (Bahasa Melayu)
- Or any other language

EXTRACT the following information carefully:

1. **merchant**: The store/vendor/business name exactly as shown
2. **date**: Transaction date - convert to YYYY-MM-DD format
3. **total_amount**: The FINAL TOTAL amount paid (number only, no currency symbols)
   - Look for: "Total", "Grand Total", "Amount Due", "合計", "총액", "Jumlah", "รวม", "Tổng", etc.
4. **tax_amount**: Tax/VAT/GST amount if shown (number only)
5. **currency**: Currency code (USD, EUR, JPY, CNY, KRW, SGD, IDR, THB, VND, MYR, TWD, HKD, etc.)
6. **items_description**: Brief summary of what was purchased
7. **category**: Best match from these categories:
   - air_tickets (flights, airline)
   - local_transport (taxi, bus, MRT, Grab, Uber)
   - overseas_transport (train, ferry between cities/countries)
   - trip_insurance
   - communication (phone, SIM, data)
   - entertainment_hospitality (restaurants, meals, entertainment)
   - equipment_tools (devices, equipment)
   - gifts_souvenirs
   - other_business
   - miscellaneous
8. **detected_language**: ISO language code (en, ko, ja, zh, id, th, vi, ms, etc.)
9. **confidence_score**: Your confidence in the extraction (0-100)

Be thorough - extract as much as you can read from the receipt.`,
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

  // Check if we got any core data
  const hasDate = ocrResult?.date && ocrResult.date.length > 0;
  const hasMerchant = ocrResult?.merchant && ocrResult.merchant.length > 0;
  const hasAmount = ocrResult?.total_amount && ocrResult.total_amount > 0;
  
  if (!hasDate && !hasMerchant && !hasAmount) {
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