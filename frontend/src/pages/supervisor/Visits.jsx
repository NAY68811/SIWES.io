import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LeafletMap from "@/components/LeafletMap";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "@phosphor-icons/react";

export default function SupervisorVisits() {
  const [students, setStudents] = useState([]);
  const [visits, setVisits] = useState([]);
  const [selected, setSelected] = useState("");
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    const s = await api.get("/allocations/my-students"); setStudents(s.data);
    const v = await api.get("/visits/mine"); setVisits(v.data);
    if (!selected && s.data[0]) setSelected(s.data[0].id);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const schedule = async (e) => {
    e.preventDefault();
    try {
      await api.post("/visits/schedule", { student_id: selected, scheduled_date: scheduledDate, note });
      toast.success("Visit scheduled"); setNote(""); load();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const verify = (visit) => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    setBusyId(visit.id);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const body = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
          const { data } = await api.post(`/visits/${visit.id}/verify`, body);
          if (data.verified) toast.success(`Visit verified — ${data.distance_m}m from site.`);
          else toast.error(`You are ${data.distance_m}m away (limit ${data.radius_m}m).`);
          load();
        } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
        finally { setBusyId(null); }
      },
      () => { toast.error("Location permission denied"); setBusyId(null); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const activeStudent = students.find(s => s.id === selected);
  const company = activeStudent?.company;

  return (
    <div className="space-y-6" data-testid="supervisor-visits">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Visits & GPS verification</h1>
        <p className="text-sm text-muted-foreground mt-1">Schedule visits and confirm your physical presence at the student's SIWES site.</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <form onSubmit={schedule} className="lg:col-span-2 rounded-xl border border-border bg-card p-6 space-y-3 h-fit">
          <h3 className="font-bold text-lg">Schedule a visit</h3>
          <div>
            <Label>Student</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger data-testid="visit-student"><SelectValue placeholder="Select student" /></SelectTrigger>
              <SelectContent>
                {students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} data-testid="visit-date" />
          </div>
          <div><Label>Note</Label><Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} /></div>
          <Button type="submit" disabled={!selected} data-testid="visit-schedule">Schedule visit</Button>
        </form>

        <div className="lg:col-span-3">
          {company ? (
            <LeafletMap marker={[company.latitude, company.longitude]} radiusMeters={150} height={340} />
          ) : (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground h-full grid place-content-center">
              <MapPin size={28} className="mx-auto mb-2" />
              Select a student with an approved company to see their site.
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-3">Scheduled & completed visits</h3>
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {visits.length === 0 && <div className="p-6 text-sm text-muted-foreground">No visits scheduled yet.</div>}
          {visits.map(v => {
            const s = students.find(x => x.id === v.student_id);
            return (
              <div key={v.id} className="p-4 flex flex-wrap items-center justify-between gap-3" data-testid={`visit-row-${v.id}`}>
                <div>
                  <div className="font-semibold">{s?.name || "Student"} · {v.scheduled_date}</div>
                  <div className="text-xs text-muted-foreground">
                    {v.note || "—"} {v.distance_m ? `· ${v.distance_m}m from site` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={v.status === "verified" ? "default" : v.status === "failed" ? "destructive" : "secondary"}>
                    {v.status}
                  </Badge>
                  {v.status === "scheduled" && (
                    <Button size="sm" onClick={() => verify(v)} disabled={busyId === v.id} data-testid={`visit-verify-${v.id}`}>
                      {busyId === v.id ? "Verifying…" : "Start visit & verify"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
