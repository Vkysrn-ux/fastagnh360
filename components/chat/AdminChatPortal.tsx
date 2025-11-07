"use client";

import { usePathname } from "next/navigation";
import ChatBox from "./ChatBox";

export default function AdminChatPortal() {
  const pathname = usePathname();
  const onTickets = pathname?.startsWith("/admin/tickets") ?? false;

  let ticketId: string | number | undefined = undefined;
  const m = pathname?.match(/^\/admin\/tickets\/(\d+)/);
  if (m && m[1]) ticketId = m[1];

  // Always mount to keep users connected across admin, UI visible only on tickets
  return <ChatBox ticketId={ticketId} visible={onTickets} />;
}
