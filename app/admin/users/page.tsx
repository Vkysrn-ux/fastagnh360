"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UsersList } from "@/components/admin/UsersList";
import RegisterUserForm from "@/components/admin/RegisterUserForm";
import { Plus, RefreshCcw } from "lucide-react";
import { getAllUsers } from "@/lib/actions/admin-actions";
import type { PortalUser } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [canManageUsers, setCanManageUsers] = useState(false);

  useEffect(() => {
    // Gate this page to Super Admin only (cached session)
    import('@/lib/client/cache').then(({ getAuthSessionCached }) =>
      getAuthSessionCached()
        .then((data: any) => {
          const sess = (data && (data.session || data)) as any;
          const display = String(sess?.displayRole || '').toLowerCase();
          const ok = !!sess && sess.userType === 'admin' && display === 'super admin';
          setCanManageUsers(ok);
          if (!ok) router.replace('/admin/tickets');
        })
        .catch(() => router.replace('/admin/tickets'))
    );
  }, [router]);

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getAllUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch users");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portal Users</h1>
          <p className="text-muted-foreground">
            Manage NH360 portal credentials for ASM, manager, and employee roles.
          </p>
        </div>
        {canManageUsers && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchUsers}
            disabled={isLoading}
          >
            {isLoading ? (
              <RefreshCcw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
          <Button size="sm" onClick={() => setIsAddUserOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
        )}
      </div>

      {canManageUsers && (
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new portal user with appropriate role and permissions
            </DialogDescription>
          </DialogHeader>
          <RegisterUserForm onSuccess={() => {
            setIsAddUserOpen(false);
            fetchUsers();
          }} />
        </DialogContent>
      </Dialog>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Search, filter, and manage portal access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-red-500 p-4 text-center">{error}</div>
          ) : (
            <UsersList users={users} onUserUpdated={fetchUsers} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
