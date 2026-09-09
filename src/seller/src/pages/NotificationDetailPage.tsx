import { useEffect, useState } from 'react'
import { FaArrowLeft } from 'react-icons/fa6'
import { Link, useParams } from 'react-router-dom'
import { getNotification, markNotificationRead } from '../lib/notifications'
import type { SellerNotification } from '../types/notifications'

const dateTime = (value: string) => new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value))

export function NotificationDetailPage() {
  const { notificationId = '' } = useParams()
  const [notification, setNotification] = useState<SellerNotification | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    document.title = 'Notification | Aisley Seller'
    getNotification(notificationId).then(({ data }) => {
      if (!active) return
      setNotification(data)
      if (!data.read_at) void markNotificationRead(data.id).then(({ data: updated }) => { if (active) setNotification(updated); window.dispatchEvent(new Event('seller-notifications-updated')) }).catch(() => {})
    }).catch(() => { if (active) setError('This notification could not be loaded.') })
    return () => { active = false }
  }, [notificationId])

  return <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
    <Link className="inline-flex items-center gap-2 text-sm font-medium text-[#4C1268] hover:underline dark:text-purple-300" to="/notifications"><FaArrowLeft aria-hidden="true" />Back to notifications</Link>
    {error ? <p className="mt-4 border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200" role="alert">{error}</p> : null}
    {!notification && !error ? <p className="py-12 text-center text-sm text-zinc-500" role="status">Loading notification…</p> : null}
    {notification ? <article className="mt-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#18181b] sm:p-7"><time className="text-xs text-zinc-500">{dateTime(notification.created_at)} PHT</time><h2 className="mt-2 text-xl font-semibold">{notification.title}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-600 dark:text-zinc-300">{notification.summary}</p>{notification.schedule ? <dl className="mt-5 grid gap-4 border-y border-zinc-200 py-4 text-sm dark:border-white/10 sm:grid-cols-2"><div><dt className="text-zinc-500">Pickup window</dt><dd className="mt-1 font-medium">{notification.schedule.starts_at && notification.schedule.ends_at ? `${dateTime(notification.schedule.starts_at)}–${new Intl.DateTimeFormat('en-PH', { timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(notification.schedule.ends_at))} PHT` : 'Unavailable'}</dd></div><div><dt className="text-zinc-500">Schedule reference</dt><dd className="mt-1 font-medium">{notification.schedule.reference ?? 'Unavailable'}</dd></div><div><dt className="text-zinc-500">Orders</dt><dd className="mt-1 font-medium">{notification.schedule.order_count ?? 'Unavailable'}</dd></div><div><dt className="text-zinc-500">Pickup area</dt><dd className="mt-1 font-medium">{notification.schedule.pickup_area ? [notification.schedule.pickup_area.city_municipality, notification.schedule.pickup_area.province, notification.schedule.pickup_area.region].filter(Boolean).join(', ') : 'Unavailable'}</dd></div></dl> : null}<Link className="mt-5 inline-flex rounded-md bg-[#4C1268] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3a0d50]" to={notification.destination}>Open related page</Link></article> : null}
  </div>
}
