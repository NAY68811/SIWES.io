import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CoordDepartments() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ name: "", code: "", faculty: "" });
  const load = () => api.get("/departments").then(r => setRows(r.data));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/departments", form);
      toast.success("Department created"); setForm({ name: "", code: "", faculty: "" }); load();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6" data-testid="coord-departments">
      <h1 className="text-3xl font-extrabold tracking-tight">Departments</h1>
      <div className="grid md:grid-cols-2 gap-6">
        <form onSubmit={submit} className="rounded-xl border border-border bg-card p-6 space-y-3">
          <h3 className="font-bold text-lg">Create department</h3>
          <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="dept-name" /></div>
          <div><Label>Code</Label><Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} data-testid="dept-code" /></div>
          <div><Label>Faculty</Label><Input value={form.faculty} onChange={(e) => setForm({ ...form, faculty: e.target.value })} /></div>
          <Button type="submit" data-testid="dept-submit">Create</Button>
        </form>
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {rows.map(d => (
            <div key={d.id} className="p-4">
              <div className="font-semibold">{d.name} <span className="text-xs text-muted-foreground">({d.code})</span></div>
              <div className="text-xs text-muted-foreground">{d.faculty || "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
