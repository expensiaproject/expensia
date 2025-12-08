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
      ? `Extract data from this PDF receipt:

    - merchant: Business name (required - guess if needed)
    - date: Transaction date as YYYY-MM-DD
    - total_amount: Final amount (just the number, required)
    - currency: USD, EUR, SGD, etc (required - infer from context)
    - tax_amount: Tax if shown, else 0
    - items_description: Brief items summary
    - category: Choose from: meals, entertainment_hospitality, local_transport, air_tickets, equipment_tools, gifts_souvenirs, communication, miscellaneous
    - detected_language: Language code (en, zh, ja, ko, etc)

    CRITICAL: Always fill merchant, total_amount, and currency even if you must guess.`
      : `Extract receipt data:

    - merchant: Store/business name
    - date: YYYY-MM-DD format
    - total_amount: Number only
    - currency: 3-letter code
    - tax_amount: Number or 0
    - items_description: What was purchased
    - category: meals, entertainment_hospitality, local_transport, air_tickets, equipment_tools, gifts_souvenirs, communication, or miscellaneous
    - detected_language: en, zh, ja, ko, etc

    CRITICAL: Always provide merchant, total_amount, and currency.`;

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

    // If we got ANY data at all, let's try to use it - be VERY lenient
    if (ocrResult && typeof ocrResult === 'object') {
      console.log('OCR succeeded, processing data...');
    } else {
      console.error('OCR returned invalid data:', ocrResult);
      return {
        success: false,
        error: "Couldn't read this receipt. Please fill in manually.",
        data: null
      };
    }
    } catch (error) {
    console.error('OCR API call failed:', error);
    return {
      success: false,
      error: "Couldn't read this receipt. Please fill in manually.",
      data: null
    };
    }

    // Be EXTREMELY lenient - if we have ANY field with data, proceed
    const hasMerchant = ocrResult.merchant && String(ocrResult.merchant).trim().length > 0;
    const hasAmount = ocrResult.total_amount && !isNaN(ocrResult.total_amount) && ocrResult.total_amount > 0;
    const hasDate = ocrResult.date && String(ocrResult.date).trim().length > 0;

    // If we don't have at least one of merchant, amount, or date, it's a failure
    if (!hasMerchant && !hasAmount && !hasDate) {
    console.error('No useful data extracted from receipt');
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