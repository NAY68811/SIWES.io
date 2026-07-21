import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { BellRinging } from "@phosphor-icons/react";

export default function Notifications() {
  const [items, setItems] = useState([]);
  const load = () => api.get("/notifications").then(r => setItems(r.data));
  useEffect(() => { load(); }, []);
  const markAll = async () => { await api.patch("/notifications/read-all"); load(); };

  return (
    <div className="max-w-3xl" data-testid="notifications-page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Notifications</h1>
        <Button variant="outline" onClick={markAll} data-testid="mark-all-read">Mark all as read</Button>
      </div>
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {items.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground flex items-center gap-3">
            <BellRinging size={20} /> No notifications yet.
          </div>
        )}
        {items.map(n => (
          <div key={n.id} className={`p-5 flex gap-4 ${n.read ? "" : "bg-primary/5"}`}>
            <div className={`h-2 w-2 mt-2 rounded-full ${n.read ? "bg-muted" : "bg-primary"}`} />
            <div className="flex-1">
              <div className="font-semibold">{n.title}</div>
              <div className="text-sm text-muted-foreground">{n.body}</div>
              <div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
