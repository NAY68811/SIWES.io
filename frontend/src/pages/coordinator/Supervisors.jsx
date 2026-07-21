import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function CoordSupervisors() {
  const [rows, setRows] = useState([]);
  const load = () => api.get("/users?role=supervisor").then(r => setRows(r.data));
  useEffect(() => { load(); }, []);
  const reset = async (id) => {
    try {
      const { data } = await api.patch(`/users/${id}/reset-password`, {});
      toast.success(`Reset. New password: ${data.new_password}`);
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };
  return (
    <div className="space-y-6" data-testid="coord-supervisors">
      <h1 className="text-3xl font-extrabold tracking-tight">Supervisors</h1>
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
            <tr><th className="p-4">Name</th><th className="p-4">Email</th><th className="p-4">Staff ID</th><th className="p-4">Phone</th><th className="p-4"></th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(s => (
              <tr key={s.id}>
                <td className="p-4 font-medium">{s.name}</td>
                <td className="p-4 text-muted-foreground">{s.email}</td>
                <td className="p-4">{s.staff_id || "—"}</td>
                <td className="p-4">{s.phone || "—"}</td>
                <td className="p-4 text-right"><Button size="sm" variant="outline" onClick={() => reset(s.id)}>Reset password</Button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-muted-foreground">No supervisors yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
