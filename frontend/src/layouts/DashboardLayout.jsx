import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  House, MapPin, ClipboardText, Users, Buildings, GraduationCap,
  ChartBar, BellRinging, UserCircle, SignOut, List, X, Notepad, Compass, FileText,
} from "@phosphor-icons/react";
import { Sun, Moon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

function navFor(role) {
  const base = [{ to: "/app", icon: House, label: "Dashboard", end: true }];
  const rest = {
    student: [
      { to: "/app/company", icon: Buildings, label: "My Company" },
      { to: "/app/logbook", icon: Notepad, label: "Logbook" },
      { to: "/app/my-supervisor", icon: UserCircle, label: "My Supervisor" },
    ],
    supervisor: [
      { to: "/app/students", icon: GraduationCap, label: "My Students" },
      { to: "/app/visits", icon: MapPin, label: "Visits & GPS" },
      { to: "/app/reviews", icon: ClipboardText, label: "Logbook Review" },
    ],
    coordinator: [
      { to: "/app/coord/students", icon: GraduationCap, label: "Students" },
      { to: "/app/coord/supervisors", icon: Users, label: "Supervisors" },
      { to: "/app/coord/companies", icon: Buildings, label: "Companies" },
      { to: "/app/coord/allocations", icon: Compass, label: "Allocations" },
      { to: "/app/coord/departments", icon: List, label: "Departments" },
      { to: "/app/coord/reports", icon: FileText, label: "Reports" },
    ],
    admin: [
      { to: "/app/coord/students", icon: GraduationCap, label: "Students" },
      { to: "/app/coord/supervisors", icon: Users, label: "Supervisors" },
      { to: "/app/coord/companies", icon: Buildings, label: "Companies" },
      { to: "/app/coord/allocations", icon: Compass, label: "Allocations" },
      { to: "/app/coord/departments", icon: List, label: "Departments" },
      { to: "/app/coord/reports", icon: ChartBar, label: "Analytics" },
    ],
  }[role] || [];
  return [...base, ...rest];
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let mounted = true;
    const fetchN = async () => {
      try {
        const { data } = await api.get("/notifications");
        if (mounted) setUnread(data.filter((n) => !n.read).length);
      } catch { /* noop */ }
    };
    fetchN();
    const iv = setInterval(fetchN, 30000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (!user) return null;
  const links = navFor(user.role);

  const doLogout = async () => { await logout(); nav("/login"); };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className={`${open ? "block" : "hidden"} lg:block fixed lg:static inset-y-0 left-0 z-40 w-72 border-r border-border bg-card`}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-border">
          <Link to="/app" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center font-black">S</div>
            <span className="font-extrabold tracking-tight">SIWES.io</span>
          </Link>
          <button className="lg:hidden" onClick={() => setOpen(false)}><X /></button>
        </div>
        <nav className="p-3 space-y-1">
          {links.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm ${
                  isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"
                }`
              }
              data-testid={`nav-${label.toLowerCase().replaceAll(" ", "-")}`}
            >
              <Icon size={18} weight="duotone" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-border bg-card">
          <div className="flex items-center gap-3 p-2 rounded-md">
            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center font-bold">
              {user.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="text-sm flex-1 min-w-0">
              <div className="font-semibold truncate">{user.name}</div>
              <div className="text-xs text-muted-foreground capitalize">{user.role}</div>
            </div>
            <button onClick={doLogout} className="p-2 rounded-md hover:bg-accent" data-testid="logout-btn" aria-label="Logout">
              <SignOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border glass sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2" onClick={() => setOpen(true)} data-testid="mobile-menu"><List /></button>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-widest">SIWES</div>
              <div className="font-bold tracking-tight capitalize">{user.role} console</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggle} className="h-9 w-9 grid place-items-center rounded-md border border-border hover:bg-accent" data-testid="theme-toggle-dash" aria-label="Toggle theme">
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <Link to="/app/notifications" className="relative h-9 w-9 grid place-items-center rounded-md border border-border hover:bg-accent" data-testid="nav-notifications">
              <BellRinging size={16} />
              {unread > 0 && <span className="absolute -top-1 -right-1 text-[10px] bg-primary text-primary-foreground rounded-full h-4 min-w-4 px-1 grid place-items-center">{unread}</span>}
            </Link>
            <Link to="/app/profile"><Button variant="outline" size="sm" data-testid="nav-profile">Profile</Button></Link>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
