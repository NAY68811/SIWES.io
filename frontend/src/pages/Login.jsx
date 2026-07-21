import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";

const DEMO = [
  { role: "Admin", email: "admin@siwes.edu", password: "Admin@1234" },
  { role: "Coordinator", email: "coordinator@siwes.edu", password: "Password@123" },
  { role: "Supervisor", email: "supervisor@siwes.edu", password: "Password@123" },
  { role: "Student", email: "student@siwes.edu", password: "Password@123" },
];

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email.trim(), password);
      toast.success("Welcome back!");
      nav("/app");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-secondary relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-40" />
        <Link to="/" className="relative flex items-center gap-2" data-testid="login-brand">
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center font-black">S</div>
          <span className="font-extrabold tracking-tight">SIWES.io</span>
        </Link>
        <div className="relative">
          <h2 className="text-3xl font-extrabold tracking-tight">The supervision layer<br /> your SIWES office was missing.</h2>
          <p className="mt-4 text-muted-foreground max-w-md">GPS-verified visits, digital logbooks, and one-click allocations — all in one place.</p>
          <div className="mt-8 rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-widest text-primary mb-3">Demo accounts</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {DEMO.map(d => (
                <button key={d.role} onClick={() => { setEmail(d.email); setPassword(d.password); }}
                  className="text-left p-3 rounded-md border border-border hover:border-primary"
                  data-testid={`demo-${d.role.toLowerCase()}`}>
                  <div className="font-bold">{d.role}</div>
                  <div className="text-muted-foreground truncate">{d.email}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="relative text-xs text-muted-foreground">© {new Date().getFullYear()} SIWES.io</div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">Enter your credentials to continue.</p>

          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="login-form">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} required
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.edu" data-testid="login-email" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} required
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" data-testid="login-password" />
            </div>
            <Button type="submit" disabled={loading} className="w-full rounded-md" data-testid="login-submit">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground">
            New here? <Link to="/register" className="text-primary font-semibold" data-testid="link-to-register">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
