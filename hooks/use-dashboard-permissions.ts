import { getUserDashboardPermissions, DashboardPermission } from '@/types/dashboard';

export function useDashboardPermissions(userRole: string): DashboardPermission {
  return getUserDashboardPermissions(userRole);
}

export function useCanAccessDashboardFeature(
  userRole: string,
  feature: keyof DashboardPermission
): boolean {
  const permissions = useDashboardPermissions(userRole);
  return permissions[feature] || false;
}