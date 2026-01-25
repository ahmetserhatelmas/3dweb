// API helper - Railway backend URL'ini kullanır
const API_URL = import.meta.env.VITE_API_URL || ''

export const apiUrl = (path) => {
  // Path / ile başlıyorsa olduğu gibi kullan, yoksa ekle
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${API_URL}${cleanPath}`
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('token')
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

export const api = {
  // Revision Requests
  async getRevisionRequests(projectId) {
    const response = await fetch(apiUrl(`/api/revisions/projects/${projectId}/revision-requests`), {
      headers: getAuthHeaders()
    })
    if (!response.ok) throw new Error('Revizyon talepleri yüklenemedi')
    return response.json()
  },

  async createRevisionRequest(projectId, fileId, data) {
    const response = await fetch(apiUrl(`/api/revisions/projects/${projectId}/files/${fileId}/revise`), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      let errorMessage = 'Revizyon talebi oluşturulamadı'
      try {
        const error = await response.json()
        errorMessage = error.error || errorMessage
      } catch (e) {
        // Response is not JSON (might be HTML error page)
        const text = await response.text()
        console.error('Non-JSON response:', text.substring(0, 200))
        errorMessage = `Sunucu hatası (${response.status})`
      }
      throw new Error(errorMessage)
    }
    return response.json()
  },

  async acceptRevisionRequest(requestId) {
    const response = await fetch(apiUrl(`/api/revisions/revision-requests/${requestId}/accept`), {
      method: 'POST',
      headers: getAuthHeaders()
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Revizyon kabul edilemedi')
    }
    return response.json()
  },

  async quoteRevisionRequest(requestId, data) {
    const response = await fetch(apiUrl(`/api/revisions/revision-requests/${requestId}/quote`), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Revizyon teklifi gönderilemedi')
    }
    return response.json()
  },

  async rejectRevisionRequest(requestId, reason) {
    const response = await fetch(apiUrl(`/api/revisions/revision-requests/${requestId}/reject`), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ rejection_reason: reason })
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Revizyon reddedilemedi')
    }
    return response.json()
  },

  async cancelRevisionRequest(requestId) {
    const response = await fetch(apiUrl(`/api/revisions/revision-requests/${requestId}/cancel`), {
      method: 'POST',
      headers: getAuthHeaders()
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Revizyon iptal edilemedi')
    }
    return response.json()
  },

  async getRevisionHistory(fileId) {
    const response = await fetch(apiUrl(`/api/revisions/files/${fileId}/revisions`), {
      headers: getAuthHeaders()
    })
    if (!response.ok) throw new Error('Revizyon geçmişi yüklenemedi')
    return response.json()
  },

  // Upload file
  async uploadFile(file) {
    const formData = new FormData()
    formData.append('file', file)

    const token = localStorage.getItem('token')
    const response = await fetch(apiUrl('/api/upload'), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Dosya yüklenemedi')
    }

    return response.json()
  }
}

export default API_URL










