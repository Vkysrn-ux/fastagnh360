"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminHeader({ isAuthenticated }: { isAuthenticated: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/admin/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <header className="py-4 border-b">
      {/* your header layout here */}
    </header>
  );
}
