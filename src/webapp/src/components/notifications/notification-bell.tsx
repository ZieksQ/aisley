"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { NotificationPopover } from "@aisley/ui/notifications";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiError } from "@/lib/api";
import { customerNotificationsUpdatedEvent, listCustomerNotifications, markCustomerNotificationRead } from "@/lib/notifications/client";
import type { CustomerNotification } from "@/lib/notifications/types";

const NOTIFICATION_PREVIEW_LIMIT = 5;

function supportTicketDestination(notification: CustomerNotification): string | null {
  if (notification.resource_type !== "support_ticket" || !isUuid(notification.resource_id ?? null)) return null;
  return `/account/support-tickets?ticket=${encodeURIComponent(notification.resource_id as string)}`;
}

function isUuid(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export function NotificationBell() {
  const { auth } = useAuth();
  return auth.status === "authenticated" ? <CustomerNotificationPreview key={auth.customer.id} /> : null;
}

function CustomerNotificationPreview() {
  const revision = useRef(0);
  const blocked = useRef(false);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (blocked.current || document.visibilityState !== "visible") return;
    const current = ++revision.current;
    setLoading(true);
    try {
      const unread = await listCustomerNotifications(new URLSearchParams({ status: "unread", per_page: String(NOTIFICATION_PREVIEW_LIMIT) }));
      const unreadItems = unread.data.slice(0, NOTIFICATION_PREVIEW_LIMIT);
      const read = unreadItems.length < NOTIFICATION_PREVIEW_LIMIT
        ? await listCustomerNotifications(new URLSearchParams({ status: "read", per_page: String(NOTIFICATION_PREVIEW_LIMIT - unreadItems.length) })) : null;
      if (current !== revision.current) return;
      setNotifications([...unreadItems, ...(read?.data ?? [])].slice(0, NOTIFICATION_PREVIEW_LIMIT));
      setUnreadCount(unread.meta.total ?? null);
      setError(null);
    } catch (caught) {
      if (current !== revision.current) return;
      if (caught instanceof ApiError && [401, 403].includes(caught.status)) {
        blocked.current = true;
        setNotifications([]);
        setUnreadCount(null);
      }
      setError("Notifications could not be refreshed.");
    } finally {
      if (current === revision.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    blocked.current = false;
    const refresh = () => void load();
    const initial = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener(customerNotificationsUpdatedEvent, refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- This numeric generation invalidates pending requests, not a DOM ref.
      ++revision.current;
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener(customerNotificationsUpdatedEvent, refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  return <NotificationPopover role="customer" triggerVariant="storefront" items={notifications} unreadCount={unreadCount}
    hasUnread={notifications.some(item => !item.read_at)} loading={loading} error={error} onRefresh={() => void load()}
    renderAction={(notification, props) => <Link {...props} href={supportTicketDestination(notification) ?? notification.destination}
      onClick={() => {
        props.onClick?.();
        if (supportTicketDestination(notification) && !notification.read_at) void markCustomerNotificationRead(notification.id).catch(() => undefined);
      }} />}
    renderViewAll={props => <Link {...props} href="/notifications" />}
  />;
}
