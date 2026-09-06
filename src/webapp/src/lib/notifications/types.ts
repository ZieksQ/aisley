export type CustomerNotification = {
  id: string;
  type: string;
  title: string;
  summary: string;
  order_id: string | null;
  order_reference: string | null;
  status: string | null;
  read_at: string | null;
  created_at: string;
  destination: string;
};

export type NotificationResponse = {
  data: CustomerNotification[];
  meta: { current_page: number; last_page: number };
};
