import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function AdminAuditLogs() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/audit-logs?limit=200").then(r => setRows(r.data)); }, []);

  return (
    <div className="space-y-6" data-testid="admin-audit-logs">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">A trail of user + role-based system actions.</p>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="p-4">When</th>
              <th className="p-4">Actor</th>
              <th className="p-4">Action</th>
              <th className="p-4">Target</th>
              <th className="p-4">Meta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(r => (
              <tr key={r.id}>
                <td className="p-4 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-4">
                  <div className="font-medium">{r.actor_email}</div>
                  <div className="text-xs text-muted-foreground capitalize">{r.actor_role}</div>
                </td>
                <td className="p-4 font-mono text-xs">{r.action}</td>
                <td className="p-4 text-muted-foreground">{r.target || "—"}</td>
                <td className="p-4 text-xs text-muted-foreground">{Object.keys(r.meta || {}).length ? JSON.stringify(r.meta) : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-muted-foreground">No audit records yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
