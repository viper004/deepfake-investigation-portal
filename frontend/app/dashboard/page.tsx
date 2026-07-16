import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Activity, ShieldAlert, CheckCircle2 } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back. Here's an overview of your investigations.</p>
        </div>
        <Button className="rounded-full bg-foreground text-background hover:bg-foreground/90 gap-2 h-10 px-6 transition-all hover:scale-[1.02]">
          <Upload className="w-4 h-4" />
          New Investigation
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover-lift">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Scans</CardTitle>
            <Activity className="w-4 h-4 text-foreground/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">124</div>
            <p className="text-xs text-muted-foreground mt-1">+12% from last month</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover-lift">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Deepfakes Detected</CardTitle>
            <ShieldAlert className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">38</div>
            <p className="text-xs text-muted-foreground mt-1">Requiring review</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover-lift">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Clean Media</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">86</div>
            <p className="text-xs text-muted-foreground mt-1">Verified authentic</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle>Recent Investigations</CardTitle>
          <CardDescription>Your most recent media analysis results.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-border/30 bg-background/30 hover:bg-background/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded bg-foreground/5 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-foreground/70" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">interview_footage_0{i}.mp4</h4>
                    <p className="text-xs text-muted-foreground">Analyzed {i} hours ago</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${i === 1 ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-500'}`}>
                    {i === 1 ? 'Deepfake Detected' : 'Authentic'}
                  </span>
                  <Button variant="ghost" size="sm" className="h-8">View</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
