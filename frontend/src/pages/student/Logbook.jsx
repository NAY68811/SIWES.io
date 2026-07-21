import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  hours: 8, activities: "", skills: "", challenges: "", image_url: "",
};

export default function StudentLogbook() {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/logbooks/mine").then(r => setEntries(r.data));
  useEffect(() => { load(); }, []);

  const upd = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, hours: Number(form.hours) };
      if (editing) await api.put(`/logbooks/${editing}`, payload);
      else await api.post("/logbooks", payload);
      toast.success(editing ? "Entry updated" : "Entry submitted");
      setForm(emptyForm); setEditing(null); load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6" data-testid="student-logbook">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Digital Logbook</h1>
        <p className="text-sm text-muted-foreground mt-1">Record your daily industrial training activities.</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <form onSubmit={submit} className="lg:col-span-2 rounded-xl border border-border bg-card p-6 space-y-3 h-fit">
          <h3 className="font-bold text-lg">{editing ? "Edit entry" : "New entry"}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date</Label><Input type="date" required value={form.date} onChange={upd("date")} data-testid="log-date" /></div>
            <div><Label>Hours</Label><Input type="number" step="0.5" required value={form.hours} onChange={upd("hours")} data-testid="log-hours" /></div>
          </div>
          <div><Label>Activities</Label><Textarea required rows={4} value={form.activities} onChange={upd("activities")} data-testid="log-activities" /></div>
          <div><Label>Skills learned</Label><Input value={form.skills} onChange={upd("skills")} data-testid="log-skills" /></div>
          <div><Label>Challenges</Label><Textarea rows={2} value={form.challenges} onChange={upd("challenges")} /></div>
          <div><Label>Image URL (optional)</Label><Input value={form.image_url} onChange={upd("image_url")} placeholder="https://…" /></div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving} data-testid="log-submit">{saving ? "Saving…" : editing ? "Update" : "Submit"}</Button>
            {editing && <Button type="button" variant="outline" onClick={() => { setEditing(null); setForm(emptyForm); }}>Cancel</Button>}
          </div>
        </form>

        <div className="lg:col-span-3 space-y-3">
          {entries.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No entries yet. Add your first activity on the left.
            </div>
          )}
          {entries.map(e => (
            <div key={e.id} className="rounded-xl border border-border bg-card p-5" data-testid={`log-entry-${e.id}`}>
              <div className="flex justify-between items-start gap-3">
                <div>
                  <div className="font-semibold">{new Date(e.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}</div>
                  <div className="text-xs text-muted-foreground">{e.hours}h · {e.skills || "—"}</div>
                </div>
                <Badge variant={e.status === "approved" ? "default" : e.status === "rejected" ? "destructive" : "secondary"}>
                  {e.status}
                </Badge>
              </div>
              <p className="mt-3 text-sm whitespace-pre-wrap">{e.activities}</p>
              {e.comment && <div className="mt-2 text-xs italic text-muted-foreground">Supervisor: {e.comment}</div>}
              {e.status !== "approved" && (
                <Button variant="ghost" size="sm" className="mt-2"
                  onClick={() => { setEditing(e.id); setForm({ date: e.date, hours: e.hours, activities: e.activities, skills: e.skills || "", challenges: e.challenges || "", image_url: e.image_url || "" }); }}
                  data-testid={`log-edit-${e.id}`}>Edit</Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
