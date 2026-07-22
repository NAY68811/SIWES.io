import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";

export default function AdminCoordinators() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", phone: "" });
  const [tempCreds, setTempCreds] = useState(null);

  const load = useCallback(async () => {
    const r = await api.get("/users?role=coordinator"); setRows(r.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/users", { ...form, role: "coordinator" });
      setTempCreds({ email: data.email, password: data.temporary_password, email_sent: data.email_sent });
      toast.success(data.email_sent ? "Coordinator created — credentials emailed" : "Coordinator created");
      load();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete ${row.name}?`)) return;
    try { await api.delete(`/users/${row.id}`); toast.success("Deleted"); load(); }
    catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6" data-testid="admin-coordinators">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Coordinators</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage SIWES coordinator accounts.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setTempCreds(null); setForm({ email: "", name: "", phone: "" }); } }}>
          <DialogTrigger asChild><Button data-testid="new-coordinator">+ New coordinator</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create coordinator</DialogTitle>
              <DialogDescription>A temporary password is generated. Share it with the coordinator — they'll be forced to change it on first login.</DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="coord-name" /></div>
              <div><Label>Email</Label><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="coord-email" /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              {tempCreds && (
                <div className="p-3 rounded-md bg-primary/10 text-sm border border-primary/30">
                  <div className="font-bold">
                    {tempCreds.email_sent
                      ? "Credentials emailed. Backup copy:"
                      : "Temporary credentials — copy now (email not delivered):"}
                  </div>
                  <div>Email: <span className="font-mono">{tempCreds.email}</span></div>
                  <div>Password: <span className="font-mono">{tempCreds.password}</span></div>
                </div>
              )}
              <DialogFooter><Button type="submit" data-testid="coord-submit">Create</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
            <tr><th className="p-4">Name</th><th className="p-4">Email</th><th className="p-4">Phone</th><th className="p-4"></th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(c => (
              <tr key={c.id}>
                <td className="p-4 font-medium">{c.name}</td>
                <td className="p-4 text-muted-foreground">{c.email}</td>
                <td className="p-4">{c.phone || "—"}</td>
                <td className="p-4 text-right"><Button size="sm" variant="destructive" onClick={() => remove(c)}>Delete</Button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-muted-foreground">No coordinators yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
