import { Link } from "react-router-dom";
import { MapPin, Compass, ClipboardText, ShieldCheck, GraduationCap, ChartBar, ArrowRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";
import { Sun, Moon } from "lucide-react";

const FEATURES = [
  { icon: MapPin, title: "GPS Visit Verification", body: "Supervisors' physical presence is verified against the student's approved SIWES site within a configurable radius." },
  { icon: ClipboardText, title: "Digital Logbook", body: "Daily activities, hours, skills learned and challenges - with image uploads and one-click supervisor approvals." },
  { icon: Compass, title: "Smart Allocation", body: "Automatic supervisor-to-student matching by department, workload balancing and manual override." },
  { icon: ShieldCheck, title: "Role-based Access", body: "Four distinct roles - Student, Supervisor, Coordinator and Admin — each with a tailored dashboard." },
  { icon: GraduationCap, title: "Company Approval", body: "Coordinators approve student placement companies before SIWES starts, with map-verified coordinates." },
  { icon: ChartBar, title: "Reports & Analytics", body: "Live dashboards for attendance, visit outcomes and departmental performance summaries." },
];

export default function Landing() {
  const { theme, toggle } = useTheme();
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Navbar */}
      <header className="sticky top-0 z-50 glass border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="brand-logo">
            <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center font-black">S</div>
            <span className="font-extrabold text-lg tracking-tight">SIWES<span className="text-primary">.io</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm">
            <a href="#features" className="hover:text-primary">Features</a>
            <a href="#roles" className="hover:text-primary">Roles</a>
            <a href="#how" className="hover:text-primary">How it works</a>
          </nav>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button onClick={toggle} className="h-9 w-9 grid place-items-center rounded-md border border-border hover:bg-accent" data-testid="theme-toggle" aria-label="Toggle theme">
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link to="/login"><Button variant="ghost" data-testid="nav-login">Login</Button></Link>
            <Link to="/register"><Button data-testid="nav-register">Get started</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero — Bento */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
        <div className="lg:col-span-8 relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground mb-6">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live GPS verification · Digital logbook · v1.0
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight">
            <span className="block">Supervise SIWES the way</span>
            <span className="block">it should have always been.</span>
          </h1>
          <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
            A single web platform for coordinators, supervisors and students -
            from company approval and supervisor allocation to GPS-verified
            visits and daily digital logbooks.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <Link to="/register"><Button size="lg" className="rounded-full px-6" data-testid="hero-get-started">Start free <ArrowRight size={18} className="ml-2" /></Button></Link>
            <Link to="/login"><Button variant="outline" size="lg" className="rounded-full px-6" data-testid="hero-signin">I have an account</Button></Link>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-4 max-w-md text-center text-sm">
            <div><div className="text-2xl font-bold">150m</div><div className="text-muted-foreground">GPS radius</div></div>
            <div><div className="text-2xl font-bold">4</div><div className="text-muted-foreground">User roles</div></div>
            <div><div className="text-2xl font-bold">24/7</div><div className="text-muted-foreground">Live tracking</div></div>
          </div>
        </div>
        <div className="lg:col-span-4 relative">
          <div className="grid grid-cols-6 grid-rows-6 gap-3 min-h-[320px] sm:min-h-[440px]">
            <div className="col-span-6 row-span-4 rounded-xl overflow-hidden border border-border">
              <img loading="lazy" src="https://images.pexels.com/photos/30954662/pexels-photo-30954662.jpeg" alt="GPS on dashboard" className="h-full w-full object-cover" />
            </div>
            <div className="col-span-3 row-span-2 rounded-xl border border-border p-4 bg-card">
              <div className="text-xs text-muted-foreground">Visits today</div>
              <div className="text-3xl font-bold">12</div>
              <div className="text-xs text-emerald-500 mt-1">10 verified · 2 pending</div>
            </div>
            <div className="col-span-3 row-span-2 rounded-xl border border-border p-4 bg-card">
              <div className="text-xs text-muted-foreground">Logbook entries</div>
              <div className="text-3xl font-bold">348</div>
              <div className="text-xs text-primary mt-1">+42 this week</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-20 border-t border-border">
        <div className="max-w-2xl mb-14">
          <div className="text-xs uppercase tracking-widest text-primary mb-3">Capabilities</div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Everything the SIWES office actually needs.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border p-6 bg-card hover:border-primary/60 transition-colors" data-testid={`feature-${title.toLowerCase().replaceAll(" ", "-")}`}>
              <Icon size={28} weight="duotone" className="text-primary" />
              <h3 className="mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="max-w-7xl mx-auto px-6 py-20 border-t border-border grid lg:grid-cols-2 gap-12 items-center">
        <img loading="lazy" src="https://images.pexels.com/photos/8199160/pexels-photo-8199160.jpeg" alt="students" className="rounded-xl border border-border object-cover w-full h-64 sm:h-80 lg:h-96" />
        <div>
          <div className="text-xs uppercase tracking-widest text-primary mb-3">One platform, four roles</div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-6">Built for the entire SIWES workflow.</h2>
          <ul className="space-y-4">
            {["Students submit companies, daily logs, images.",
              "Supervisors schedule visits, verify GPS, review logs.",
              "Coordinators allocate supervisors and approve companies.",
              "Admins manage the entire system and analytics."].map(t => (
              <li key={t} className="flex gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                <span className="text-sm text-muted-foreground">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section id="how" className="max-w-7xl mx-auto px-6 py-20 border-t border-border">
        <div className="rounded-2xl border border-border p-10 lg:p-14 bg-card flex flex-col lg:flex-row items-center lg:items-center text-center lg:text-left">
          <div>
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Ready to modernize your SIWES office?</h3>
            <p className="mt-2 text-muted-foreground">Set up in minutes. Create an account or login to get Started</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <Link to="/register"><Button size="lg" className="rounded-full px-6" data-testid="cta-register">Create account</Button></Link>
            <Link to="/login"><Button size="lg" variant="outline" className="rounded-full px-6" data-testid="cta-login">Login</Button></Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 text-sm text-muted-foreground flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
          <div>© {new Date().getFullYear()} SIWES.io - Built for academic use.</div>
        </div>
      </footer>
    </div>
  );
}
