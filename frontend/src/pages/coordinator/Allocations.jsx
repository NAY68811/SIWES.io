import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CoordAllocations() {
  const [rows, setRows] = useState([]);
  const [students, setStudents] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [selStu, setSelStu] = useState("");
  const [selSup, setSelSup] = useState("");

  const load = async () => {
    const [a, s, sv] = await Promise.all([
      api.get("/allocations"),
      api.get("/users?role=student"),
      api.get("/users?role=supervisor"),
    ]);
    setRows(a.data); setStudents(s.data); setSupervisors(sv.data);
  };
  useEffect(() => { load(); }, []);

  const auto = async () => {
    try { const { data } = await api.post("/allocations/auto"); toast.success(`Auto-allocated ${data.assigned} student(s)`); load(); }
    catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const manual = async () => {
    if (!selStu || !selSup) return toast.error("Select both student and supervisor");
    try { await api.post("/allocations/manual", { student_id: selStu, supervisor_id: selSup }); toast.success("Allocation saved"); setSelStu(""); setSelSup(""); load(); }
    catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6" data-testid="coord-allocations">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">Allocations</h1>
        <Button onClick={auto} data-testid="auto-allocate">Auto-allocate all</Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 grid md:grid-cols-3 gap-3 items-end">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Student</div>
          <Select value={selStu} onValueChange={setSelStu}>
            <SelectTrigger data-testid="manual-student"><SelectValue placeholder="Choose student" /></SelectTrigger>
            <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Supervisor</div>
          <Select value={selSup} onValueChange={setSelSup}>
            <SelectTrigger data-testid="manual-supervisor"><SelectValue placeholder="Choose supervisor" /></SelectTrigger>
            <SelectContent>{supervisors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={manual} data-testid="manual-assign">Assign / Reassign</Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
            <tr><th className="p-4">Student</th><th className="p-4">Supervisor</th><th className="p-4">Assigned by</th><th className="p-4">Date</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(a => (
              <tr key={a.id}>
                <td className="p-4 font-medium">{a.student?.name || "—"}</td>
                <td className="p-4">{a.supervisor?.name || "—"}</td>
                <td className="p-4 capitalize">{a.assigned_by}</td>
                <td className="p-4 text-muted-foreground">{a.assigned_at?.slice(0, 10)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-muted-foreground">No allocations yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
