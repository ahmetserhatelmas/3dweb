/**
 * Format number to Turkish currency format
 * Example: 1234567.89 -> 1.234.567,89
 */
export function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return ''
  
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return ''
  
  // Split into integer and decimal parts
  const [integerPart, decimalPart = '00'] = num.toFixed(2).split('.')
  
  // Format integer part with dots
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  
  // Combine with comma for decimals
  return `${formattedInteger},${decimalPart}`
}

/**
 * Parse Turkish formatted currency to number
 * Example: 1.234.567,89 -> 1234567.89
 */
export function parseCurrency(value) {
  if (!value) return 0
  
  // Remove dots (thousand separators) and replace comma with dot
  const cleaned = value.toString().replace(/\./g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  
  return isNaN(num) ? 0 : num
}

/**
 * Format input value while typing
 * Allows only numbers, dots, and comma
 */
export function formatCurrencyInput(value) {
  if (value === null || value === undefined) return ''
  
  // Convert to string (numbers from API come as number)
  const str = typeof value === 'number' ? String(value) : String(value)
  if (str === '' || str === 'NaN') return ''
  
  // Remove all non-numeric characters except comma
  let cleaned = str.replace(/[^\d,]/g, '')
  
  // Allow only one comma
  const parts = cleaned.split(',')
  if (parts.length > 2) {
    cleaned = parts[0] + ',' + parts.slice(1).join('')
  }
  
  // Limit decimal places to 2
  if (parts.length === 2 && parts[1].length > 2) {
    cleaned = parts[0] + ',' + parts[1].substring(0, 2)
  }
  
  // Format integer part with dots
  const [integerPart, decimalPart] = cleaned.split(',')
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  
  // Show decimal part; if none (e.g. value from API), add ",00"
  if (decimalPart !== undefined) {
    return `${formattedInteger},${decimalPart}`
  }
  // Number without comma (e.g. 3213) -> show as "3.213,00"
  return formattedInteger ? `${formattedInteger},00` : ''
}
