import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import './ThemeToggle.css'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      title={isLight ? 'Karanlık moda geç' : 'Açık moda geç'}
      aria-label={isLight ? 'Karanlık moda geç' : 'Açık moda geç'}
    >
      {isLight ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  )
}
