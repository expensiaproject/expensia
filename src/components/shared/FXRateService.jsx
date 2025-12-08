import { base44 } from '@/api/base44Client';

/**
 * Fetches FX rate for a given currency pair on a specific date
 * Uses AI to fetch live FX rates from the internet
 * 
 * @param {string} fromCurrency - Source currency (e.g., "KRW", "JPY")
 * @param {string} toCurrency - Target currency (e.g., "USD")
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<number>} FX rate (1 unit of fromCurrency = X toCurrency)
 */
export async function fetchFXRate(fromCurrency, toCurrency, date) {
  // If same currency, rate is 1
  if (fromCurrency === toCurrency) {
    return 1;
  }

  try {
    console.log(`Fetching FX rate: ${fromCurrency} → ${toCurrency} on ${date}`);
    
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `What is the exchange rate for ${fromCurrency} to ${toCurrency} on ${date}?

Please search the internet for the accurate exchange rate on this specific date.

Return the rate as: 1 ${fromCurrency} = X ${toCurrency}

For example:
- If 1 USD = 1328 KRW, then 1 KRW = 0.000753 USD
- If 1 USD = 150 JPY, then 1 JPY = 0.00667 USD
- If 1 EUR = 1.08 USD, then 1 EUR = 1.08 USD

IMPORTANT: Return the rate for converting FROM ${fromCurrency} TO ${toCurrency}.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          rate: { 
            type: 'number',
            description: `Exchange rate: 1 ${fromCurrency} = X ${toCurrency}`
          },
          date: { type: 'string' },
          source: { type: 'string' }
        },
        required: ['rate']
      }
    });

    if (!result || !result.rate || result.rate <= 0) {
      throw new Error('Invalid FX rate returned');
    }

    console.log(`FX rate fetched: 1 ${fromCurrency} = ${result.rate} ${toCurrency}`);
    return result.rate;
    
  } catch (error) {
    console.error('Failed to fetch FX rate:', error);
    // Fallback: return 1 if base currency, otherwise throw
    if (fromCurrency === 'USD') return 1;
    throw new Error(`Could not fetch FX rate for ${fromCurrency} → ${toCurrency}`);
  }
}

/**
 * Calculate base amount using FX rate
 * @param {number} amount - Original amount
 * @param {number} fxRate - FX rate (1 original currency = X base currency)
 * @returns {number} Converted amount rounded to 2 decimals
 */
export function calculateBaseAmount(amount, fxRate) {
  if (!amount || !fxRate) return 0;
  return Math.round(amount * fxRate * 100) / 100;
}

export default { fetchFXRate, calculateBaseAmount };