// app/admin/suppliers/[id]/products/page.tsx
import SupplierProductTable from "@/components/admin/SupplierProductTable";

// This is the new page component
export default async function SupplierProductsPage({ params }: { params: { id: string } }) {
  const { id: supplierId } = await params;
  

  // Defensive: Don't render if ID is missing
  if (!supplierId) {
    return <div className="text-center py-8 text-muted-foreground">Supplier not found.</div>;
  }

  return (
    <div className="container py-8">
      <SupplierProductTable supplierId={supplierId} />
    </div>
  );
}
