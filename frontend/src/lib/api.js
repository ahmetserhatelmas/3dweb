// API helper - Railway backend URL'ini kullanır
const API_URL = import.meta.env.VITE_API_URL || ''

export const apiUrl = (path) => {
  // Path / ile başlıyorsa olduğu gibi kullan, yoksa ekle
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${API_URL}${cleanPath}`
}

export default API_URL

