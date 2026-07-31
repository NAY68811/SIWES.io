import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default function SupervisorReviews() {
  const [students, setStudents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selected, setSelected] = useState("");
  const [comment, setComment] = useState({});

  useEffect(() => {
    api.get("/allocations/my-students").then(r => {
      setStudents(r.data);
      setSelected((prev) => prev || r.data[0]?.id || "");
    });
  }, []);

  const loadLogs = useCallback(async () => {
    if (!selected) return;
    const r = await api.get(`/logbooks/student/${selected}`);
    setLogs(r.data);
  }, [selected]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const review = async (lid, status) => {
    try {
      await api.patch(`/logbooks/${lid}/review`, { status, comment: comment[lid] || null });
      toast.success(`Entry ${status}`);
      await loadLogs();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6" data-testid="supervisor-reviews">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">Logbook Review</h1>
        <p className="text-sm text-muted-foreground mt-1">Approve or reject student logbook entries.</p>
      </div>
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
        {students.map(s => (
          <button key={s.id} onClick={() => setSelected(s.id)}
            className={`px-3 py-1.5 rounded-md text-sm border ${selected === s.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
            data-testid={`review-tab-${s.id}`}>
            {s.name}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {logs.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground text-center">
            No entries for this student yet.
          </div>
        )}
        {logs.map(l => (
          <div key={l.id} className="rounded-xl border border-border bg-card p-5" data-testid={`review-log-${l.id}`}>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
              <div>
                <div className="font-semibold">{new Date(l.date).toLocaleDateString()}</div>
                <div className="text-xs text-muted-foreground">{l.hours}h · {l.skills || "—"}</div>
              </div>
              <Badge variant={l.status === "approved" ? "default" : l.status === "rejected" ? "destructive" : "secondary"}>{l.status}</Badge>
            </div>
            <p className="mt-3 text-sm whitespace-pre-wrap">{l.activities}</p>
            {l.image_url && (
              <img src={l.image_url.startsWith("http") ? l.image_url : `${process.env.REACT_APP_BACKEND_URL}${l.image_url}`}
                alt="logbook" className="mt-3 w-full rounded-lg border border-border object-cover max-h-72" />
            )}
            {l.challenges && <p className="mt-2 text-xs italic text-muted-foreground">Challenge: {l.challenges}</p>}
            {l.status === "pending" && (
              <div className="mt-4 space-y-2">
                <Textarea rows={2} placeholder="Optional comment" value={comment[l.id] || ""}
                  onChange={e => setComment({ ...comment, [l.id]: e.target.value })} />
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button size="sm" className="w-full sm:w-auto" onClick={() => review(l.id, "approved")} data-testid={`approve-${l.id}`}>Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => review(l.id, "rejected")} data-testid={`reject-${l.id}`}>Reject</Button>
                </div>
              </div>
            )}
            {l.comment && l.status !== "pending" && (
              <div className="mt-2 text-xs italic text-muted-foreground">Your comment: {l.comment}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
