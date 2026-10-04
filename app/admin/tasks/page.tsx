import TaskBoard from "@/components/tasks/TaskBoard";

export default function AdminTasksPage() {
  return <TaskBoard ticketBasePath="/admin/tickets" />;
}
