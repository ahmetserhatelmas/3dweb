import { differenceInDays, isPast, isToday } from 'date-fns'

export const getDaysRemaining = (dateString) => {
  if (!dateString) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Normalize today to start of day
  const targetDate = new Date(dateString)
  targetDate.setHours(0, 0, 0, 0) // Normalize target date to start of day

  if (isPast(targetDate) && !isToday(targetDate)) {
    const days = differenceInDays(today, targetDate)
    return { days, isOverdue: true }
  } else {
    const days = differenceInDays(targetDate, today)
    return { days, isOverdue: false }
  }
}

export const getUrgencyClass = (dateString) => {
  const result = getDaysRemaining(dateString)
  if (!result) return ''

  const { days, isOverdue } = result

  if (isOverdue) return 'overdue' // Kırmızı + Arka plan
  if (days <= 10) return 'urgent' // Kırmızı
  return 'warning' // Sarı - Normal
}

export const formatDeadlineInfo = (dateString) => {
  const result = getDaysRemaining(dateString)
  if (!result) return null

  const { days, isOverdue } = result

  let daysStr = ''
  let urgency = ''

  if (isOverdue) {
    daysStr = `${days} gün geçti`
    urgency = 'overdue' // Kırmızı + Arka plan
  } else if (days === 0) {
    daysStr = 'Bugün'
    urgency = 'urgent' // Kırmızı
  } else if (days <= 10) {
    daysStr = `${days} gün kaldı`
    urgency = 'urgent' // Kırmızı - 10 gün veya daha az
  } else {
    daysStr = `${days} gün kaldı`
    urgency = 'warning' // Sarı - Normal
  }

  return { daysStr, urgency, days, isOverdue }
}
