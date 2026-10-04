import TaskBoard from "@/components/tasks/TaskBoard";

// Lives under /employee/tickets so the existing employee route guard in middleware allows it.
export default function EmployeeTasksPage() {
  return <TaskBoard ticketBasePath="/employee/tickets" />;
}
