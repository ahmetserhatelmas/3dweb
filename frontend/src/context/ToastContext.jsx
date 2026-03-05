import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

const TOAST_DURATION = 5000

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, TOAST_DURATION)
  }, [])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map(({ id, message, type }) => (
          <div
            key={id}
            className={`toast toast-${type}`}
            role="alert"
          >
            <span>{message}</span>
            <button
              type="button"
              className="toast-dismiss"
              onClick={() => dismiss(id)}
              aria-label="Kapat"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) return { showToast: (msg) => window.alert(msg) }
  return ctx
}
