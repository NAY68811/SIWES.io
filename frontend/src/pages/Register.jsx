import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiError } from "@/lib/api";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: "", email: "", password: "", phone: "",
    matric_no: "", department_id: "", level: "400",
  });
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/departments").then((r) => setDepts(r.data)).catch(() => {});
  }, []);

  const upd = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, email: form.email.trim().toLowerCase() };
      if (!payload.department_id) delete payload.department_id;
      await register(payload);
      toast.success("Account created!");
      nav("/app");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Registration failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-6 lg:p-12 order-2 lg:order-1">
        <div className="w-full max-w-md">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Student registration</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Students can create their own accounts. Supervisor and Coordinator accounts are created by the SIWES Office.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4" data-testid="register-form">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Full name</Label>
                <Input value={form.name} required onChange={upd("name")} data-testid="reg-name" />
              </div>
              <div className="col-span-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} required onChange={upd("email")} data-testid="reg-email" />
              </div>
              <div className="col-span-2">
                <Label>Password</Label>
                <Input type="password" value={form.password} required onChange={upd("password")} data-testid="reg-password" />
              </div>
              <div>
                <Label>Department</Label>
                <Select value={form.department_id} onValueChange={upd("department_id")}>
                  <SelectTrigger data-testid="reg-department"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {depts.map(d => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={upd("phone")} data-testid="reg-phone" />
              </div>
              <div>
                <Label>Matric No.</Label>
                <Input value={form.matric_no} onChange={upd("matric_no")} data-testid="reg-matric" />
              </div>
              <div>
                <Label>Level</Label>
                <Select value={form.level} onValueChange={upd("level")}>
                  <SelectTrigger data-testid="reg-level"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["200","300","400","500"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full" data-testid="register-submit">
              {loading ? "Creating…" : "Create student account"}
            </Button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            Have an account? <Link to="/login" className="text-primary font-semibold" data-testid="link-to-login">Sign in</Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:flex flex-col justify-between p-12 bg-secondary order-1 lg:order-2 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-40" />
        <Link to="/" className="relative flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center font-black">S</div>
          <span className="font-extrabold tracking-tight">SIWES.io</span>
        </Link>
        <img src="https://images.pexels.com/photos/37198874/pexels-photo-37198874.jpeg" alt="engineers" className="rounded-xl border border-border object-cover w-full max-h-[420px] relative" />
        <div className="relative text-xs text-muted-foreground">© {new Date().getFullYear()} SIWES.io</div>
      </div>
    </div>
  );
}
