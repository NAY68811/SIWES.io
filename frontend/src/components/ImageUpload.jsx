import { useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { UploadSimple, Image as ImageIcon, X } from "@phosphor-icons/react";

/**
 * File upload widget backed by the object-storage API.
 * scope: 'logbook' | 'avatar'
 * value: current image URL (relative /api/uploads/file/<id> path)
 * onChange: (newRelativeUrl | null) => void
 */
export default function ImageUpload({ scope, value, onChange, testId }) {
  const [busy, setBusy] = useState(false);

  const backend = process.env.REACT_APP_BACKEND_URL;
  const previewUrl = value
    ? (value.startsWith("http") ? value : `${backend}${value}`)
    : null;

  const pick = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Max size 5MB");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post(`/uploads/${scope}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChange(data.url);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-3">
      {previewUrl ? (
        <div className="relative">
          <img src={previewUrl} alt="upload" className="h-16 w-16 rounded-md object-cover border border-border" />
          <button type="button" onClick={() => onChange(null)}
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground grid place-items-center"
            data-testid={`${testId}-remove`}>
            <X size={12} />
          </button>
        </div>
      ) : (
        <div className="h-16 w-16 rounded-md border border-dashed border-border grid place-items-center text-muted-foreground">
          <ImageIcon size={20} />
        </div>
      )}
      <label className="cursor-pointer">
        <input type="file" accept="image/*" className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
          data-testid={testId} disabled={busy} />
        <span className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
          <UploadSimple size={16} /> {busy ? "Uploading…" : (previewUrl ? "Replace image" : "Upload image")}
        </span>
      </label>
    </div>
  );
}
