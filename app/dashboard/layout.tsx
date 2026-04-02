import { Sidebar } from "@/components/dashboard/Sidebar";
import { RightSidebar } from "@/components/dashboard/RightSidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex">
      <Sidebar />
      <main className="flex-1 overflow-auto min-h-full">{children}</main>
      <RightSidebar />
    </div>
  );
}
