import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError, API } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Cloud, DownloadSimple, UploadSimple } from "@phosphor-icons/react";

export default function AdminBackup() {
  const [restoring, setRestoring] = useState(false);
  const [stats, setStats] = useState(null);
  const fileRef = useRef(null);

  const download = async () => {
    // Trigger a browser download using cookie auth by hitting the API directly
    const win = window.open(`${API}/admin/backup`, "_blank");
    if (!win) toast.error("Please allow popups to download the backup");
  };

  const restore = async (file) => {
    if (!file) return;
    if (!window.confirm("This will REPLACE all current data with the backup. Continue?")) return;
    setRestoring(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/admin/restore", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setStats(data.restored);
      toast.success("Restore complete");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setRestoring(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="admin-backup">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Backup & Restore</h1>
        <p className="text-sm text-muted-foreground mt-1">Download a full JSON snapshot of all SIWES collections, or restore from a previous backup.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-3"><DownloadSimple weight="duotone" size={20} className="text-primary" /><h3 className="font-bold text-lg">Backup</h3></div>
          <p className="text-sm text-muted-foreground mb-4">Exports users, departments, companies, logbooks, visits, allocations, assessments, notifications, and audit logs.</p>
          <Button onClick={download} data-testid="backup-download">
            Download backup (JSON)
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-3"><UploadSimple weight="duotone" size={20} className="text-destructive" /><h3 className="font-bold text-lg">Restore</h3></div>
          <p className="text-sm text-muted-foreground mb-4">
            <strong className="text-destructive">Destructive:</strong> replaces all existing records with the backup contents.
          </p>
          <input ref={fileRef} type="file" accept="application/json" onChange={(e) => restore(e.target.files?.[0])} className="hidden" data-testid="restore-input" />
          <Button variant="destructive" onClick={() => fileRef.current?.click()} disabled={restoring} data-testid="restore-btn">
            {restoring ? "Restoring…" : "Upload & restore"}
          </Button>
        </div>
      </div>

      {stats && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-3"><Cloud size={18} /><h3 className="font-bold">Last restore</h3></div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {Object.entries(stats).map(([k, v]) => (
                <tr key={k}><td className="py-2">{k}</td><td className="py-2 text-right font-mono">{v} docs</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
