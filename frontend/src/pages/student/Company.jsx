import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import LeafletMap from "@/components/LeafletMap";
import { Badge } from "@/components/ui/badge";

export default function StudentCompany() {
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState({
    name: "", address: "", state: "", lga: "",
    latitude: 6.5244, longitude: 3.3792, industry: "",
    supervisor_name: "", supervisor_phone: "", supervisor_email: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/companies/mine").then(r => {
      if (r.data) { setCompany(r.data); setForm(r.data); }
    }).catch(() => {});
  }, []);

  const upd = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    navigator.geolocation.watchPosition(
      (pos) => setForm(f => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude })),
      () => toast.error("Could not read your location"),
      { enableHighAccuracy: true }
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, latitude: Number(form.latitude), longitude: Number(form.longitude) };
      const { data } = await api.post("/companies", payload);
      setCompany(data);
      toast.success(company ? "Company updated (pending re-approval)" : "Company submitted for approval");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6" data-testid="student-company">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">My Placement</h1>
          <p className="text-sm text-muted-foreground mt-1">Register or update your SIWES placement details.</p>
        </div>
        {company && (
          <Badge variant={company.status === "approved" ? "default" : "secondary"} data-testid="company-status">
            {company.status.toUpperCase()}
          </Badge>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <form onSubmit={submit} className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
          <div><Label>Company name</Label><Input required value={form.name} onChange={upd("name")} data-testid="company-name" /></div>
          <div><Label>Address</Label><Textarea required value={form.address} onChange={upd("address")} data-testid="company-address" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>State</Label><Input required value={form.state} onChange={upd("state")} data-testid="company-state" /></div>
            <div><Label>LGA</Label><Input value={form.lga} onChange={upd("lga")} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Latitude</Label><Input required type="number" step="any" value={form.latitude} onChange={upd("latitude")} data-testid="company-lat" /></div>
            <div><Label>Longitude</Label><Input required type="number" step="any" value={form.longitude} onChange={upd("longitude")} data-testid="company-lng" /></div>
          </div>
          <Button type="button" variant="outline" onClick={useMyLocation} className="w-full sm:w-auto" data-testid="use-my-location">Use my current location</Button>
          <div><Label>Industry</Label><Input value={form.industry} onChange={upd("industry")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Company supervisor name</Label><Input value={form.supervisor_name} onChange={upd("supervisor_name")} /></div>
            <div><Label>Phone</Label><Input value={form.supervisor_phone} onChange={upd("supervisor_phone")} /></div>
          </div>
          <div><Label>Email</Label><Input type="email" value={form.supervisor_email} onChange={upd("supervisor_email")} /></div>
          <Button type="submit" disabled={loading} className="w-full sm:w-auto" data-testid="company-submit">
            {loading ? "Saving…" : company ? "Update company" : "Submit for approval"}
          </Button>
        </form>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Click on the map to place your company location, or use &ldquo;Use my current location&rdquo;.</p>
          <LeafletMap
            marker={[Number(form.latitude), Number(form.longitude)]}
            onPick={(lat, lng) => setForm(f => ({ ...f, latitude: lat, longitude: lng }))}
          />
        </div>
      </div>
    </div>
  );
}
