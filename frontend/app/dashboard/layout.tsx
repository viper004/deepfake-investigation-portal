import Link from "next/link";
import { LayoutDashboard, Settings, FileSearch, LogOut, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background noise-overlay flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border/50 bg-card/30 backdrop-blur-md hidden md:flex flex-col relative z-10">
        <div className="h-16 flex items-center px-6 border-b border-border/50">
          <Link href="/" className="font-display text-xl font-bold tracking-tight">
            Optimus
          </Link>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-1">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 text-sm font-medium bg-foreground/5 text-foreground rounded-md transition-colors">
            <LayoutDashboard className="w-4 h-4" />
            Overview
          </Link>
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-foreground/5 rounded-md transition-colors">
            <FileSearch className="w-4 h-4" />
            Investigations
          </Link>
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-foreground/5 rounded-md transition-colors">
            <Settings className="w-4 h-4" />
            Settings
          </Link>
        </nav>

        <div className="p-4 border-t border-border/50">
          <Link href="/" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-foreground/5 rounded-md transition-colors">
            <LogOut className="w-4 h-4" />
            Log out
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative z-10">
        <header className="h-16 border-b border-border/50 bg-card/30 backdrop-blur-md flex items-center px-6 justify-between">
          <div className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" />
            <Input type="text" placeholder="Search investigations..." className="pl-9 bg-background/50 h-9 border-border/50" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-foreground/10 border border-border/50 flex items-center justify-center font-medium text-sm">
              JD
            </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
