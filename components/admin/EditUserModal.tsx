"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortalUser } from "@/lib/types";
import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format").optional().nullable(),
  phone: z.string().optional().nullable(),
  role: z.string().min(1, "Role is required"),
  status: z.string().min(1, "Status is required"),
  dashboard: z.string().min(1, "Dashboard is required"),
});

interface EditUserModalProps {
  user: PortalUser;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const ROLES = [
  "admin",
  "asm",
  "manager",
  "employee",
  "agent",
  "team-leader",
  "toll-agent",
  "channel-partner",
  "fse",
  "shop",
  "shop_owner",
  "showroom",
  "executive",
  "office",
];

const STATUSES = ["active", "inactive", "pending"];
const DASHBOARDS = ["admin", "agent", "employee"];

export function EditUserModal({
  user,
  isOpen,
  onClose,
  onSuccess,
}: EditUserModalProps) {
  if (!user) return null;
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const [agentOptions, setAgentOptions] = useState<Array<{ id: number; name: string; role: string }>>([]);

  useEffect(() => {
    // Load potential parents (agents/managers etc.)
    fetch('/api/agents')
      .then(r => r.json())
      .then(arr => {
        if (Array.isArray(arr)) setAgentOptions(arr.map((a: any) => ({ id: Number(a.id), name: a.name, role: a.role })));
      })
      .catch(() => setAgentOptions([]));
  }, []);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "",
      status: user.status || "active",
      dashboard: user.dashboard || "agent",
      // injected dynamically below
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsLoading(true);
      const payload = {
        id: user.id,
        ...values,
        parent_id: (document.getElementById('parent_user_id_select') as HTMLSelectElement | null)?.value
          ? Number((document.getElementById('parent_user_id_select') as HTMLSelectElement).value)
          : null,
      };
      const res = await fetch('/api/users/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to update user');
      }

      toast.success("User updated successfully");
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to update user");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
          <DialogDescription>
            View and edit user information
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="edit">Edit</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-sm">ID</h4>
                <p className="text-sm text-muted-foreground">{user.id}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm">Created</h4>
                <p className="text-sm text-muted-foreground">
                  {user.created_at ? format(new Date(user.created_at), "PPpp") : "-"}
                </p>
              </div>
              <div>
                <h4 className="font-medium text-sm">Name</h4>
                <p className="text-sm text-muted-foreground">{user.name || "-"}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm">Email</h4>
                <p className="text-sm text-muted-foreground">{user.email || "-"}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm">Phone</h4>
                <p className="text-sm text-muted-foreground">{user.phone || "-"}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm">Role</h4>
                <p className="text-sm text-muted-foreground">{user.role}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm">Status</h4>
                <p className="text-sm text-muted-foreground">{user.status}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm">Dashboard</h4>
                <p className="text-sm text-muted-foreground">{user.dashboard}</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="edit">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Parent (optional) */}
                <div>
                  <FormLabel>Parent (Optional)</FormLabel>
                  <select id="parent_user_id_select" defaultValue={String(user.parent_id ?? "")} className="w-full border rounded px-3 py-2">
                    <option value="">No Parent</option>
                    {agentOptions
                      .filter(o => o.id !== user.id)
                      .map(o => (
                        <option key={o.id} value={String(o.id)}>{o.name} ({o.role})</option>
                      ))}
                  </select>
                </div>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ROLES.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dashboard"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dashboard</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select dashboard" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DASHBOARDS.map((dashboard) => (
                              <SelectItem key={dashboard} value={dashboard}>
                                {dashboard}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Updating..." : "Update User"}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
