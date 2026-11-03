import { redirect } from "next/navigation";

export default async function ConversationPage({ params }: { params: Promise<{ conversation: string }> }) {
  const { conversation } = await params;
  redirect(`/messages?kind=customer_shop&conversation=${encodeURIComponent(conversation)}`);
}
