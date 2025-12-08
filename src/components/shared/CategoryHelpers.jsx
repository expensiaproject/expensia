export const CATEGORIES = [
  { value: 'air_tickets', label: 'Air Tickets', description: 'Flights, airline bookings' },
  { value: 'local_transport', label: 'Local Transport', description: 'Taxi, bus, MRT, ride-hailing' },
  { value: 'overseas_transport', label: 'Overseas Transport', description: 'Intercity trains, inter-country transport' },
  { value: 'trip_insurance', label: 'Trip Insurance', description: 'Travel/trip insurance premiums' },
  { value: 'communication', label: 'Communication Expenses', description: 'Roaming, SIM card, data packages' },
  { value: 'entertainment_hospitality', label: 'Entertainment & Hospitality', description: 'Client meals, entertainment' },
  { value: 'equipment_tools', label: 'Equipment & Tools', description: 'Devices, tools, work equipment' },
  { value: 'gifts_souvenirs', label: 'Gifts & Souvenirs', description: 'Business gifts, souvenirs' },
  { value: 'meals', label: 'Meals', description: 'Business meals, food expenses' },
  { value: 'lodging', label: 'Lodging', description: 'Hotels, accommodation' },
  { value: 'health', label: 'Health', description: 'Medical, health expenses' },
  { value: 'other_business', label: 'Other Business Expenses', description: 'Valid business expenses' },
  { value: 'miscellaneous', label: 'Miscellaneous', description: 'Temporary/unclassified items' }
];

export const PAYMENT_METHODS = [
  { value: 'card', label: 'Card' },
  { value: 'cash', label: 'Cash' }
];

export const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'SGD', 'JPY', 'CNY', 'HKD', 'AUD', 'CAD', 'CHF',
  'INR', 'KRW', 'MYR', 'THB', 'IDR', 'PHP', 'VND', 'TWD', 'NZD', 'AED'
];

export const getCategoryLabel = (value) => {
  const cat = CATEGORIES.find(c => c.value === value);
  return cat ? cat.label : value;
};

export const getPaymentMethodLabel = (value) => {
  const pm = PAYMENT_METHODS.find(p => p.value === value);
  return pm ? pm.label : value;
};

export const getCategoryColor = (category) => {
  const colors = {
    air_tickets: 'bg-blue-100 text-blue-800',
    local_transport: 'bg-green-100 text-green-800',
    overseas_transport: 'bg-teal-100 text-teal-800',
    trip_insurance: 'bg-purple-100 text-purple-800',
    communication: 'bg-cyan-100 text-cyan-800',
    entertainment_hospitality: 'bg-pink-100 text-pink-800',
    equipment_tools: 'bg-orange-100 text-orange-800',
    gifts_souvenirs: 'bg-rose-100 text-rose-800',
    meals: 'bg-amber-100 text-amber-800',
    lodging: 'bg-emerald-100 text-emerald-800',
    health: 'bg-red-100 text-red-800',
    other_business: 'bg-indigo-100 text-indigo-800',
    miscellaneous: 'bg-gray-100 text-gray-800'
  };
  return colors[category] || 'bg-gray-100 text-gray-800';
};

export const getStatusColor = (status) => {
  const colors = {
    draft: 'bg-gray-100 text-gray-700',
    submitted: 'bg-amber-100 text-amber-800',
    reimbursed: 'bg-green-100 text-green-800',
    open: 'bg-gray-100 text-gray-700',
    paid: 'bg-green-100 text-green-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
};

export const formatCurrency = (amount, currency = 'USD') => {
  if (amount === null || amount === undefined) return '-';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
};

export const calculateTotalBaseAmount = (expenses) => {
  return expenses.reduce((sum, exp) => {
    // Use baseAmount if available, otherwise fallback to amount (for USD expenses)
    const amount = exp.baseAmount !== null && exp.baseAmount !== undefined 
      ? exp.baseAmount 
      : (exp.currency === 'USD' ? exp.amount : 0);
    return sum + (amount || 0);
  }, 0);
};