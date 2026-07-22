import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const emptyForm = { email: "", name: "", staff_id: "", phone: "", department_id: "" };

export default function CoordSupervisors() {
  const [rows, setRows] = useState([]);
  const [depts, setDepts] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [tempCreds, setTempCreds] = useState(null);

  const load = useCallback(async () => {
    const [r, d] = await Promise.all([
      api.get("/users?role=supervisor"),
      api.get("/departments"),
    ]);
    setRows(r.data); setDepts(d.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const upd = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }));

  const openNew = () => {
    setEditing(null); setForm(emptyForm); setTempCreds(null); setOpen(true);
  };
  const openEdit = (row) => {
    setEditing(row);
    setForm({
      email: row.email, name: row.name || "",
      staff_id: row.staff_id || "", phone: row.phone || "",
      department_id: row.department_id || "",
    });
    setTempCreds(null); setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, form);
        toast.success("Supervisor updated");
        setOpen(false);
      } else {
        const payload = { ...form, role: "supervisor" };
        if (!payload.department_id) delete payload.department_id;
        const { data } = await api.post("/users", payload);
        setTempCreds({ email: data.email, password: data.temporary_password });
        toast.success("Supervisor created");
      }
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally { setSaving(false); }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete ${row.name}?`)) return;
    try { await api.delete(`/users/${row.id}`); toast.success("Deleted"); load(); }
    catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const reset = async (row) => {
    try {
      const { data } = await api.patch(`/users/${row.id}/reset-password`, {});
      toast.success(`Reset. Temporary password: ${data.new_password}`);
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6" data-testid="coord-supervisors">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Supervisors</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage supervisor accounts.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} data-testid="new-supervisor">+ New supervisor</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit supervisor" : "Create supervisor"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-3" data-testid="supervisor-form">
              <div><Label>Name</Label><Input required value={form.name} onChange={upd("name")} data-testid="sup-name" /></div>
              <div><Label>Email</Label><Input required type="email" disabled={!!editing} value={form.email} onChange={upd("email")} data-testid="sup-email" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Staff ID</Label><Input value={form.staff_id} onChange={upd("staff_id")} data-testid="sup-staff" /></div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={upd("phone")} data-testid="sup-phone" /></div>
              </div>
              <div>
                <Label>Department</Label>
                <Select value={form.department_id} onValueChange={upd("department_id")}>
                  <SelectTrigger data-testid="sup-dept"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {depts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {tempCreds && (
                <div className="p-3 rounded-md bg-primary/10 text-sm border border-primary/30">
                  <div className="font-bold">Temporary credentials — copy now:</div>
                  <div>Email: <span className="font-mono">{tempCreds.email}</span></div>
                  <div>Password: <span className="font-mono">{tempCreds.password}</span></div>
                </div>
              )}
              <DialogFooter>
                <Button type="submit" disabled={saving} data-testid="sup-submit">
                  {saving ? "Saving…" : editing ? "Save changes" : "Create supervisor"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="p-4">Name</th><th className="p-4">Email</th>
              <th className="p-4">Staff ID</th><th className="p-4">Phone</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(s => (
              <tr key={s.id} data-testid={`sup-row-${s.id}`}>
                <td className="p-4 font-medium">{s.name}</td>
                <td className="p-4 text-muted-foreground">{s.email}</td>
                <td className="p-4">{s.staff_id || "—"}</td>
                <td className="p-4">{s.phone || "—"}</td>
                <td className="p-4 text-right space-x-2 whitespace-nowrap">
                  <Button size="sm" variant="outline" onClick={() => openEdit(s)} data-testid={`sup-edit-${s.id}`}>Edit</Button>
                  <Button size="sm" variant="outline" onClick={() => reset(s)}>Reset pwd</Button>
                  <Button size="sm" variant="destructive" onClick={() => remove(s)} data-testid={`sup-del-${s.id}`}>Delete</Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-muted-foreground">No supervisors yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
