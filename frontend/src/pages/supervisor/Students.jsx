import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { GraduationCap } from "@phosphor-icons/react";

export default function SupervisorStudents() {
  const [students, setStudents] = useState([]);
  useEffect(() => { api.get("/allocations/my-students").then(r => setStudents(r.data)); }, []);
  return (
    <div className="space-y-6" data-testid="supervisor-students">
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">My Students</h1>
      {students.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <GraduationCap size={28} className="mx-auto mb-2" />
          No students allocated yet.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {students.map(s => (
          <div key={s.id} className="rounded-xl border border-border bg-card p-4 sm:p-5" data-testid={`student-card-${s.id}`}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center font-bold">{s.name?.[0]}</div>
              <div>
                <div className="font-bold break-words">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.matric_no || "—"} · Level {s.level || "—"}</div>
              </div>
            </div>
            <div className="mt-3 text-sm text-muted-foreground break-all">{s.email}</div>
            {s.company ? (
              <div className="mt-4 border-t border-border pt-3">
                <div className="text-xs text-muted-foreground break-words">Company</div>
                <div className="font-semibold">{s.company.name}</div>
                <div className="text-xs text-muted-foreground">{s.company.address}</div>
                <div className="text-xs mt-1">Status: <span className="capitalize">{s.company.status}</span></div>
              </div>
            ) : (
              <div className="mt-4 text-xs text-muted-foreground">No company registered.</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
