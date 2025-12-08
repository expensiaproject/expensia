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
      ? `You are reading a PDF receipt document. Read ALL text from the PDF and extract the following information:

**Required fields (MUST provide):**
1. merchant: The business/store/company name (look at the top of the document - this is the most prominent text)
2. total_amount: The final total amount as a NUMBER ONLY (look for "Total", "Amount Due", "Grand Total", "Balance", "Net Amount" - extract just the number, like 25.50, not "$25.50")
3. currency: The currency code like USD, SGD, EUR, GBP, JPY, etc. (infer from $ signs, country, or text in the document)

**Optional fields:**
4. date: Transaction date in YYYY-MM-DD format (today is ${new Date().toISOString().split('T')[0]} for reference)
5. tax_amount: Tax/GST/VAT amount as number only (or 0 if not shown)
6. items_description: Brief summary of items/services purchased
7. category: Best match from: meals, entertainment_hospitality, local_transport, air_tickets, equipment_tools, gifts_souvenirs, communication, miscellaneous
8. detected_language: Language code (en, zh, ja, ko, id, th, etc.)
9. confidence_score: Your confidence 0-100
10. raw_ocr_text: All text you can see in the PDF

**CRITICAL INSTRUCTIONS:**
- This is a PDF file - read the text content carefully
- ALWAYS provide merchant, total_amount, and currency - never leave these empty
- If unclear, make your best educated guess based on context
- For amounts, extract only numbers (25.50 not $25.50 or USD 25.50)
- Return actual values, never "Unknown", "N/A", "null", or empty strings`
      : `You are reading a receipt image. Extract the following:

**Required (MUST provide):**
1. merchant: Store/business name
2. total_amount: Final total as number only
3. currency: USD, EUR, SGD, etc.

**Optional:**
4. date: YYYY-MM-DD
5. tax_amount: Number or 0
6. items_description: What was purchased
7. category: meals, entertainment_hospitality, local_transport, air_tickets, equipment_tools, gifts_souvenirs, communication, or miscellaneous
8. detected_language: en, zh, ja, ko, etc.
9. confidence_score: 0-100
10. raw_ocr_text: All visible text

**CRITICAL:**
- Always provide merchant, total_amount, and currency
- Extract numbers only for amounts
- Never return "Unknown" or empty values for required fields`;

    console.log('Sending OCR request for', isPdf ? 'PDF' : 'image', 'file...');
    
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
    
    console.log('✅ OCR Response received:', JSON.stringify(ocrResult, null, 2));
  } catch (error) {
    console.error('❌ OCR API call failed:', error);
    return {
      success: false,
      error: "Failed to process receipt. Please try again or fill in manually.",
      data: null
    };
  }

  // Validate we got a valid response object
  if (!ocrResult || typeof ocrResult !== 'object') {
    console.error('❌ Invalid OCR response:', ocrResult);
    return {
      success: false,
      error: "Couldn't read this receipt. Please fill in manually.",
      data: null
    };
  }

  // Check what data we got - be VERY lenient
  const hasMerchant = ocrResult.merchant && 
    String(ocrResult.merchant).trim().length > 0 && 
    !['unknown', 'n/a', 'null', 'undefined', 'none', ''].includes(String(ocrResult.merchant).toLowerCase().trim());
  
  const hasAmount = ocrResult.total_amount !== null && 
    ocrResult.total_amount !== undefined && 
    !isNaN(ocrResult.total_amount) && 
    ocrResult.total_amount > 0;
  
  const hasDate = ocrResult.date && 
    String(ocrResult.date).trim().length > 0 &&
    !['unknown', 'n/a', 'null', 'undefined', 'none', ''].includes(String(ocrResult.date).toLowerCase().trim());

  console.log('Data validation:', { hasMerchant, hasAmount, hasDate });

  // Success if we have at least one piece of useful data
  if (!hasMerchant && !hasAmount && !hasDate) {
    console.error('❌ No useful data extracted from receipt');
    return {
      success: false,
      error: "Couldn't extract data from this receipt. Please fill in manually.",
      data: null
    };
  }

  console.log('✅ OCR successful, extracted data is usable');

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