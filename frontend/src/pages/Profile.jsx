import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ImageUpload from "@/components/ImageUpload";

export default function Profile() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || "", phone: user?.phone || "",
    matric_no: user?.matric_no || "", staff_id: user?.staff_id || "",
    level: user?.level || "", avatar: user?.avatar || "",
  });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (user) setForm(f => ({ ...f,
      name: user.name, phone: user.phone || "",
      matric_no: user.matric_no || "", staff_id: user.staff_id || "",
      level: user.level || "", avatar: user.avatar || "",
    }));
  }, [user]);

  const upd = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch("/users/me", form);
      await refresh();
      toast.success("Profile updated");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl" data-testid="profile-page">
      <h1 className="text-3xl font-extrabold tracking-tight mb-6">Profile</h1>
      <form onSubmit={save} className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <Label>Avatar</Label>
          <ImageUpload
            scope="avatar"
            value={form.avatar}
            onChange={(url) => setForm(f => ({ ...f, avatar: url || "" }))}
            testId="avatar-upload"
          />
        </div>
        <div>
          <Label>Full name</Label>
          <Input value={form.name} onChange={upd("name")} data-testid="profile-name" />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={user.email} disabled />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={form.phone} onChange={upd("phone")} data-testid="profile-phone" />
        </div>
        {user.role === "student" && (
          <>
            <div>
              <Label>Matric no.</Label>
              <Input value={form.matric_no} onChange={upd("matric_no")} data-testid="profile-matric" />
            </div>
            <div>
              <Label>Level</Label>
              <Input value={form.level} onChange={upd("level")} />
            </div>
          </>
        )}
        {user.role === "supervisor" && (
          <div>
            <Label>Staff ID</Label>
            <Input value={form.staff_id} onChange={upd("staff_id")} data-testid="profile-staff-id" />
          </div>
        )}
        <Button type="submit" disabled={saving} data-testid="profile-save">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </div>
  );
}
