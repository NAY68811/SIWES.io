import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function CoordCompanies() {
  const [rows, setRows] = useState([]);
  const load = () => api.get("/companies").then(r => setRows(r.data));
  useEffect(() => { load(); }, []);
  const decide = async (id, status) => {
    try { await api.patch(`/companies/${id}/status`, { status }); toast.success(`Company ${status}`); load(); }
    catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };
  return (
    <div className="space-y-4 sm:space-y-6 px-1 sm:px-0" data-testid="coord-companies">
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">Companies</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rows.map(c => (
          <div key={c.id} className="rounded-xl border border-border bg-card p-4 sm:p-5" data-testid={`company-card-${c.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-bold break-words">{c.name}</div>
                <div className="text-xs text-muted-foreground break-words">{c.address}, {c.state}</div>
                <div className="text-xs text-muted-foreground break-all">>Lat {c.latitude.toFixed(4)}, Lng {c.longitude.toFixed(4)}</div>
              </div>
              <Badge variant={c.status === "approved" ? "default" : c.status === "rejected" ? "destructive" : "secondary"}>{c.status}</Badge>
            </div>
            {c.status === "pending" && (
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <Button size="sm" className="w-full sm:w-auto" onClick={() => decide(c.id, "approved")} data-testid={`approve-company-${c.id}`}>Approve</Button>
                <Button size="sm" variant="destructive" onClick={() => decide(c.id, "rejected")} data-testid={`reject-company-${c.id}`}>Reject</Button>
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No companies submitted yet.</div>}
      </div>
    </div>
  );
}
