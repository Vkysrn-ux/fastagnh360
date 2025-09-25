import { DailySales } from "@/components/dashboard/DailySales";
import { PendingAmount } from "@/components/dashboard/PendingAmount";
import { AgentInventory } from "@/components/dashboard/AgentInventory";
import { TotalSales } from "@/components/dashboard/TotalSales";
import { useCanAccessDashboardFeature } from "@/hooks/use-dashboard-permissions";

interface DashboardProps {
  userRole: string;
}

export default function Dashboard({ userRole }: DashboardProps) {
  const canViewDailySales = useCanAccessDashboardFeature(userRole, 'viewDailySales');
  const canViewPendingAmount = useCanAccessDashboardFeature(userRole, 'viewDailyPendingAmount');
  const canViewInventory = useCanAccessDashboardFeature(userRole, 'viewOwnInventory');
  const canViewTotalSales = useCanAccessDashboardFeature(userRole, 'viewTotalSales');
  
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      
      <div className="grid grid-cols-12 gap-6">
        {/* Conditional rendering based on permissions */}
        {canViewDailySales && <DailySales />}
        {canViewPendingAmount && <PendingAmount />}
        {canViewInventory && <AgentInventory />}
        {canViewTotalSales && <TotalSales />}
      </div>
    </div>
  );
}