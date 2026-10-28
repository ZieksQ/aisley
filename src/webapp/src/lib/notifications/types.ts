export type CustomerNotification = {
  id: string;
  type: string;
  title: string;
  summary: string;
  category?: string | null;
  category_label?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  order_id: string | null;
  order_reference: string | null;
  status: string | null;
  read_at: string | null;
  created_at: string;
  destination: string;
};

export type NotificationResponse = {
  data: CustomerNotification[];
  meta: {
    current_page: number;
    last_page: number;
    per_page?: number;
    total?: number;
    categories?: { key: string; label: string }[];
  };
};
