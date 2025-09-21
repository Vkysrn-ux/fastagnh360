"use client";

import { PortalUser } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import { EditUserModal } from "./EditUserModal";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface UsersListProps {
  users: PortalUser[];
  onUserUpdated?: () => void;
}

export function UsersList({ users, onUserUpdated }: UsersListProps) {
  const [selectedUser, setSelectedUser] = useState<PortalUser | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Portal</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow 
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className="cursor-pointer hover:bg-muted/60 active:bg-muted transition-colors"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedUser(user);
                  }
                }}
              >
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email || "-"}</TableCell>
                <TableCell>{user.phone || "-"}</TableCell>
                <TableCell className="capitalize">{user.role}</TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                      {
                        "bg-green-100 text-green-800": user.status === "active",
                        "bg-red-100 text-red-800": user.status === "inactive",
                        "bg-yellow-100 text-yellow-800": user.status === "pending",
                      }
                    )}
                  >
                    {user.status}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                    {user.dashboard}
                  </span>
                </TableCell>
                <TableCell>
                  {user.created_at
                    ? format(new Date(user.created_at), "dd/MM/yyyy")
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedUser && (
        <EditUserModal
          user={selectedUser}
          isOpen={true}
          onClose={() => setSelectedUser(null)}
          onSuccess={() => {
            onUserUpdated?.();
            setSelectedUser(null);
          }}
        />
      )}
    </div>
  );
}