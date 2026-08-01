import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const stat = (label, value, sub) => ({ label, value, sub });

function StatCard({ label, value, sub, testid }) {
  return (
    <div className="stat-card rounded-xl border border-border bg-card p-4 min-h-[120px] flex flex-col justify-between" data-testid={testid}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`);
      }}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold mt-2 tracking-tight break-words">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

export default function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState({});
  const [chart, setChart] = useState([]);
  const firstName =
    user?.name?.trim()?.split(" ")[0] || "User";

  useEffect(() => {
    api.get("/dashboard/stats").then(r => setStats(r.data)).catch(() => {});
    api.get("/dashboard/chart").then(r => setChart(r.data)).catch(() => {});
  }, []);

  const items = (() => {
    if (user?.role === "student") return [
      stat("Total entries", stats.total_days ?? 0, "days logged"),
      stat("Approved", stats.approved ?? 0, "entries"),
      stat("Pending", stats.pending ?? 0, "awaiting review"),
      stat("Verified visits", stats.visits ?? 0, "GPS confirmed"),
    ];
    if (user?.role === "supervisor") return [
      stat("Assigned students", stats.students ?? 0),
      stat("Upcoming visits", stats.upcoming_visits ?? 0),
      stat("Verified visits", stats.verified_visits ?? 0),
      stat("Pending logbooks", stats.pending_logbooks ?? 0),
    ];
    return [
      stat("Students", stats.students ?? 0),
      stat("Supervisors", stats.supervisors ?? 0),
      stat("Pending companies", stats.pending_companies ?? 0),
      stat("Verified visits", stats.verified_visits ?? 0),
    ];
  })();

  return (
    <div className="space-y-4 sm:space-y-6 px-1 sm:px-0" data-testid="dashboard-home">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
          Welcome back,
          <br className="sm:hidden" />
          <span className="text-primary">
              {" "}
              {firstName}
          </span>
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Here's what's happening across your SIWES workspace.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((s, i) => <StatCard key={s.label} {...s} testid={`stat-${i}`} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <h3 className="text-lg font-bold">Logbook activity</h3>
            <span className="text-xs text-muted-foreground">last 8 weeks</span>
          </div>
          <div className="h-56 sm:h-64 w-full overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart.length ? chart : [{week: "—", entries: 0}]}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="week"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                />

                <YAxis
                  allowDecimals={false}
                  width={30}
                  tick={{ fontSize: 10 }}
                />
                
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="entries" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 lg:p-6 space-y-4">
          <h3 className="text-lg font-bold">Quick tips</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {user.role === "student" && "Register your company from ‘My Company’, then submit a daily logbook entry. Your supervisor will review it."}
            {user.role === "supervisor" && "Open ‘Visits & GPS’ to schedule a physical visit and verify your location within 150m of the student’s approved company."}
            {(user.role === "coordinator" || user.role === "admin") && "Use ‘Allocations’ to auto-assign supervisors or manually reassign students. Approve companies from the Companies tab."}
          </p>
          <div className="border-t border-border pt-3">
            <div className="text-xs uppercase tracking-widest text-primary">GPS radius</div>
            <div className="text-sm text-muted-foreground">150 m from the approved site.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
