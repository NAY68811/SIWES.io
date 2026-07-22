import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { UserCircle, Envelope, Phone, IdentificationBadge, Star } from "@phosphor-icons/react";

function StarRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex gap-0.5">
        {[1,2,3,4,5].map(n => (
          <Star key={n} size={16} weight={n <= (value || 0) ? "fill" : "regular"}
            className={n <= (value || 0) ? "text-amber-400" : "text-muted-foreground/30"} />
        ))}
      </div>
    </div>
  );
}

export default function MySupervisor() {
  const { user } = useAuth();
  const [sup, setSup] = useState(null);
  const [visits, setVisits] = useState([]);
  const [assessment, setAssessment] = useState(null);

  useEffect(() => {
    api.get("/allocations/my-supervisor").then(r => setSup(r.data)).catch(() => {});
    api.get("/visits/mine").then(r => setVisits(r.data)).catch(() => {});
    if (user?.id) {
      api.get(`/assessments/student/${user.id}`).then(r => setAssessment(r.data[0] || null)).catch(() => {});
    }
  }, [user]);

  return (
    <div className="space-y-6" data-testid="my-supervisor">
      <h1 className="text-3xl font-extrabold tracking-tight">My Supervisor</h1>
      {sup ? (
        <div className="rounded-xl border border-border bg-card p-6 max-w-xl">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 text-primary grid place-items-center text-xl font-bold">
              {sup.name?.[0]}
            </div>
            <div>
              <div className="text-lg font-bold">{sup.name}</div>
              <div className="text-xs text-muted-foreground capitalize">{sup.role}</div>
            </div>
          </div>
          <div className="mt-5 space-y-2 text-sm">
            <div className="flex items-center gap-2"><Envelope /> {sup.email}</div>
            {sup.phone && <div className="flex items-center gap-2"><Phone /> {sup.phone}</div>}
            {sup.staff_id && <div className="flex items-center gap-2"><IdentificationBadge /> {sup.staff_id}</div>}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <UserCircle size={32} className="mx-auto mb-2" />
          No supervisor assigned yet. Please wait for your coordinator to allocate one.
        </div>
      )}

      {assessment && (
        <div className="rounded-xl border border-border bg-card p-6 max-w-xl">
          <h3 className="font-bold text-lg mb-4">My assessment</h3>
          <div className="space-y-2">
            <StarRow label="Overall rating" value={assessment.rating} />
            <StarRow label="Punctuality" value={assessment.punctuality} />
            <StarRow label="Teamwork" value={assessment.teamwork} />
            <StarRow label="Technical skill" value={assessment.technical_skill} />
          </div>
          {assessment.feedback && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Feedback</div>
              <p className="text-sm whitespace-pre-wrap">{assessment.feedback}</p>
            </div>
          )}
        </div>
      )}

      <div>
        <h3 className="text-xl font-bold mb-3">Visit history</h3>
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {visits.length === 0 && <div className="p-6 text-sm text-muted-foreground">No visits yet.</div>}
          {visits.map(v => (
            <div key={v.id} className="p-4 flex justify-between items-center flex-wrap gap-2">
              <div>
                <div className="font-semibold">{v.scheduled_date}</div>
                <div className="text-xs text-muted-foreground">Distance: {v.distance_m ? `${v.distance_m}m` : "—"}</div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-md ${v.status === "verified" ? "bg-emerald-500/15 text-emerald-500" : v.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
                {v.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
