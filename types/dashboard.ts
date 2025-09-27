export type DashboardPermission = {
  viewAllDashboards?: boolean;
  viewDailySales?: boolean;
  viewDailyPendingAmount?: boolean;
  viewSalesAndAmount?: boolean;
  viewOwnInventory?: boolean;
  viewTotalSales?: boolean;
};

export type RoleDashboardPermissions = {
  'Super Admin': DashboardPermission;
  'Admin': DashboardPermission;
  'Accountant/HR': DashboardPermission;
  'Manager': DashboardPermission;
  'TeamLead': DashboardPermission;
  'Agent': DashboardPermission;
};

export const DASHBOARD_PERMISSIONS: RoleDashboardPermissions = {
  // Super Admin - view all dashboards
  'Super Admin': {
    viewAllDashboards: true,
    viewDailySales: true,
    viewDailyPendingAmount: true,
    viewSalesAndAmount: true,
    viewOwnInventory: true,
    viewTotalSales: true
  },
  // Admin - similar to Super Admin but reserved for main admin features
  'Admin': {
    viewAllDashboards: true,
    viewDailySales: true,
    viewDailyPendingAmount: true,
    viewSalesAndAmount: true,
    viewOwnInventory: true,
    viewTotalSales: true
  },
  // Accountant/HR - view daily sales & amount, daily pending amount, all other dashboard
  'Accountant/HR': {
    viewDailySales: true,
    viewDailyPendingAmount: true,
    viewSalesAndAmount: true,
    viewAllDashboards: false,
    viewOwnInventory: false,
    viewTotalSales: false
  },
  // Manager - view daily sales, daily pending amount, all other dashboard
  'Manager': {
    viewDailySales: true,
    viewDailyPendingAmount: true,
    viewAllDashboards: false,
    viewSalesAndAmount: false,
    viewOwnInventory: false,
    viewTotalSales: false
  },
  // TeamLead - view daily sales, daily pending amount, all other dashboard
  'TeamLead': {
    viewDailySales: true,
    viewDailyPendingAmount: true,
    viewAllDashboards: false,
    viewSalesAndAmount: false,
    viewOwnInventory: false,
    viewTotalSales: false
  },
  // Agent - his own inventory, daily sales, total sales
  'Agent': {
    viewOwnInventory: true,
    viewDailySales: true,
    viewTotalSales: true,
    viewAllDashboards: false,
    viewDailyPendingAmount: false,
    viewSalesAndAmount: false
  }
};

export function getUserDashboardPermissions(role: string): DashboardPermission {
  const normalizedRole = role as keyof RoleDashboardPermissions;
  return DASHBOARD_PERMISSIONS[normalizedRole] || {
    viewOwnInventory: true,
    viewDailySales: true,
    viewTotalSales: true
  }; // Default to Agent permissions if role not found
}
