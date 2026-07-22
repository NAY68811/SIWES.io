import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star } from "@phosphor-icons/react";

function Stars({ value, onChange, testid }) {
  return (
    <div className="flex gap-1" data-testid={testid}>
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={n <= value ? "text-amber-400" : "text-muted-foreground/40"}>
          <Star size={22} weight={n <= value ? "fill" : "regular"} />
        </button>
      ))}
    </div>
  );
}

export default function SupervisorAssessments() {
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState("");
  const [form, setForm] = useState({ rating: 4, punctuality: 4, teamwork: 4, technical_skill: 4, feedback: "" });
  const [existing, setExisting] = useState(null);

  const loadStudents = useCallback(async () => {
    const r = await api.get("/allocations/my-students");
    setStudents(r.data);
    setSelected(prev => prev || r.data[0]?.id || "");
  }, []);
  useEffect(() => { loadStudents(); }, [loadStudents]);

  const loadExisting = useCallback(async () => {
    if (!selected) return;
    const { data } = await api.get(`/assessments/student/${selected}`);
    if (data.length) {
      const a = data[0]; setExisting(a);
      setForm({ rating: a.rating, punctuality: a.punctuality || 4, teamwork: a.teamwork || 4, technical_skill: a.technical_skill || 4, feedback: a.feedback || "" });
    } else {
      setExisting(null);
      setForm({ rating: 4, punctuality: 4, teamwork: 4, technical_skill: 4, feedback: "" });
    }
  }, [selected]);
  useEffect(() => { loadExisting(); }, [loadExisting]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/assessments", { student_id: selected, ...form });
      toast.success(existing ? "Assessment updated" : "Assessment submitted");
      loadExisting();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6" data-testid="supervisor-assessments">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Student Assessment</h1>
        <p className="text-sm text-muted-foreground mt-1">End-of-SIWES performance evaluation. Students see submitted assessments.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {students.map(s => (
          <button key={s.id} onClick={() => setSelected(s.id)}
            className={`px-3 py-1.5 rounded-md text-sm border ${selected === s.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
            data-testid={`assess-tab-${s.id}`}>
            {s.name}
          </button>
        ))}
      </div>

      {selected && (
        <form onSubmit={submit} className="max-w-2xl rounded-xl border border-border bg-card p-6 space-y-5">
          <div>
            <Label>Overall rating</Label>
            <Stars value={form.rating} onChange={v => setForm(f => ({ ...f, rating: v }))} testid="stars-rating" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label>Punctuality</Label><Stars value={form.punctuality} onChange={v => setForm(f => ({ ...f, punctuality: v }))} testid="stars-punctuality" /></div>
            <div><Label>Teamwork</Label><Stars value={form.teamwork} onChange={v => setForm(f => ({ ...f, teamwork: v }))} testid="stars-teamwork" /></div>
            <div><Label>Technical skill</Label><Stars value={form.technical_skill} onChange={v => setForm(f => ({ ...f, technical_skill: v }))} testid="stars-tech" /></div>
          </div>
          <div>
            <Label>Feedback</Label>
            <Textarea rows={4} value={form.feedback} onChange={(e) => setForm(f => ({ ...f, feedback: e.target.value }))} data-testid="assess-feedback" />
          </div>
          <Button type="submit" data-testid="assess-submit">{existing ? "Update assessment" : "Submit assessment"}</Button>
        </form>
      )}
    </div>
  );
}
