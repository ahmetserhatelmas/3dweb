/**
 * Para birimi formatlama yardımcı fonksiyonları
 */

/**
 * Sayıyı binlik ayraçlı Türk para birimi formatına çevirir
 * Örnek: 1234.5 → "1.234,50"
 */
export function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) return '0,00'
  return Number(value).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

/**
 * Input alanı için para birimi formatı (yazarken)
 * Sadece rakam ve virgül/nokta kabul eder, binlik nokta ekler
 * Örnek: "1234,5" → "1.234,5"
 */
export function formatCurrencyInput(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Sadece rakam, nokta ve virgül bırak
  const cleaned = str.replace(/[^\d.,]/g, '')
  // Virgülü ondalık ayraç olarak kullan, noktaları kaldır
  const normalized = cleaned.replace(/\./g, '').replace(',', '.')
  const parts = normalized.split('.')
  const intPart = parts[0] || ''
  const decPart = parts[1] !== undefined ? ',' + parts[1] : ''
  // Binlik nokta ekle
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return formatted + decPart
}

/**
 * Para birimi string'ini sayıya çevirir
 * Örnek: "1.234,50" → 1234.50
 */
export function parseCurrency(value) {
  if (value === null || value === undefined || value === '') return 0
  const str = String(value)
  // Binlik noktaları kaldır, virgülü noktaya çevir
  const normalized = str.replace(/\./g, '').replace(',', '.')
  const num = parseFloat(normalized)
  return isNaN(num) ? 0 : num
}

/**
 * Input değerini temizleyip ham sayıya çevirir
 */
export function sanitizeCurrencyInput(value) {
  return parseCurrency(value)
}

/**
 * Ham sayıyı input-uyumlu string'e çevirir
 * Örnek: 1234.5 → "1.234,5"
 */
export function toRawCurrencyString(value) {
  if (value === null || value === undefined || isNaN(value) || value === 0) return ''
  const str = String(value).replace('.', ',')
  const parts = str.split(',')
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const decPart = parts[1] ? ',' + parts[1] : ''
  return intPart + decPart
}
