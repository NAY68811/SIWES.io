import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

export default function AdminAuditLogs() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.get("/audit-logs?limit=200").then((r) => setRows(r.data));
  }, []);

  return (
    <div className="space-y-6 p-4 md:p-6" data-testid="admin-audit-logs">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          Audit Logs
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          A trail of user and role-based system actions.
        </p>
      </div>

      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No audit records yet.
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden lg:block rounded-xl border border-border bg-card overflow-x-auto">
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
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-4 whitespace-nowrap text-xs">
                  {new Date(r.created_at).toLocaleString()}
                </td>

                <td className="p-4">
                  <div className="font-medium">{r.actor_email}</div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {r.actor_role}
                  </div>
                </td>

                <td className="p-4 font-mono text-xs">
                  {r.action}
                </td>

                <td className="p-4">
                  {r.target || "—"}
                </td>

                <td className="p-4 text-xs break-all">
                  {Object.keys(r.meta || {}).length
                    ? JSON.stringify(r.meta)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-4">
        {rows.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex justify-between items-start gap-3">
              <div>
                <h3 className="font-semibold break-all">
                  {r.actor_email}
                </h3>

                <Badge variant="secondary" className="mt-1 capitalize">
                  {r.actor_role}
                </Badge>
              </div>

              <span className="text-xs text-muted-foreground text-right">
                {new Date(r.created_at).toLocaleDateString()}
              </span>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div>
                <span className="font-semibold">Action:</span>{" "}
                <span className="font-mono">{r.action}</span>
              </div>

              <div>
                <span className="font-semibold">Target:</span>{" "}
                {r.target || "—"}
              </div>

              <div>
                <span className="font-semibold">Meta:</span>

                <div className="mt-1 text-xs text-muted-foreground break-all">
                  {Object.keys(r.meta || {}).length
                    ? JSON.stringify(r.meta)
                    : "—"}
                </div>
              </div>

              <div className="text-xs text-muted-foreground pt-2 border-t">
                {new Date(r.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}