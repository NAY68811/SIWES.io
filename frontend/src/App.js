import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import DashboardLayout from "@/layouts/DashboardLayout";
import DashboardHome from "@/pages/DashboardHome";
import StudentCompany from "@/pages/student/Company";
import StudentLogbook from "@/pages/student/Logbook";
import StudentSupervisor from "@/pages/student/MySupervisor";
import SupervisorStudents from "@/pages/supervisor/Students";
import SupervisorVisits from "@/pages/supervisor/Visits";
import SupervisorReviews from "@/pages/supervisor/Reviews";
import CoordStudents from "@/pages/coordinator/Students";
import CoordSupervisors from "@/pages/coordinator/Supervisors";
import CoordCompanies from "@/pages/coordinator/Companies";
import CoordAllocations from "@/pages/coordinator/Allocations";
import CoordDepartments from "@/pages/coordinator/Departments";
import CoordReports from "@/pages/coordinator/Reports";
import Profile from "@/pages/Profile";
import Notifications from "@/pages/Notifications";
import "@/App.css";

function Protected() {
  const { user, checked } = useAuth();
  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route element={<Protected />}>
              <Route element={<DashboardLayout />}>
                <Route path="/app" element={<DashboardHome />} />
                <Route path="/app/profile" element={<Profile />} />
                <Route path="/app/notifications" element={<Notifications />} />

                {/* Student */}
                <Route path="/app/company" element={<StudentCompany />} />
                <Route path="/app/logbook" element={<StudentLogbook />} />
                <Route path="/app/my-supervisor" element={<StudentSupervisor />} />

                {/* Supervisor */}
                <Route path="/app/students" element={<SupervisorStudents />} />
                <Route path="/app/visits" element={<SupervisorVisits />} />
                <Route path="/app/reviews" element={<SupervisorReviews />} />

                {/* Coordinator/Admin */}
                <Route path="/app/coord/students" element={<CoordStudents />} />
                <Route path="/app/coord/supervisors" element={<CoordSupervisors />} />
                <Route path="/app/coord/companies" element={<CoordCompanies />} />
                <Route path="/app/coord/allocations" element={<CoordAllocations />} />
                <Route path="/app/coord/departments" element={<CoordDepartments />} />
                <Route path="/app/coord/reports" element={<CoordReports />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
