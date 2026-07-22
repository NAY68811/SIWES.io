import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ChangePassword() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (next.length < 6) return toast.error("Password must be at least 6 characters");
    if (next !== confirm) return toast.error("Passwords do not match");
    setSaving(true);
    try {
      await api.post("/auth/change-password", { current_password: current, new_password: next });
      await refresh();
      toast.success("Password updated");
      nav("/app");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-md mx-auto" data-testid="change-password-page">
      <h1 className="text-3xl font-extrabold tracking-tight">Change your password</h1>
      {user?.must_change_password && (
        <p className="mt-2 text-sm text-amber-500">
          Your SIWES office created this account with a temporary password. Please set a new one to continue.
        </p>
      )}
      <form onSubmit={submit} className="mt-6 rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <Label>Current password</Label>
          <Input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} data-testid="cp-current" />
        </div>
        <div>
          <Label>New password</Label>
          <Input type="password" required value={next} onChange={(e) => setNext(e.target.value)} data-testid="cp-new" />
        </div>
        <div>
          <Label>Confirm new password</Label>
          <Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} data-testid="cp-confirm" />
        </div>
        <Button type="submit" disabled={saving} data-testid="cp-submit">
          {saving ? "Saving…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
