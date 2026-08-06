import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CoordStudents() {
  const [students, setStudents] = useState([]);
  const [q, setQ] = useState("");
  const load = () => api.get("/users?role=student").then(r => setStudents(r.data));
  useEffect(() => { load(); }, []);
  const reset = async (id) => {
    try {
      const { data } = await api.patch(`/users/${id}/reset-password`, {});
      toast.success(`Reset. New password: ${data.new_password}`);
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };
  const filtered = students.filter(s => (s.name + s.email + (s.matric_no || "")).toLowerCase().includes(q.toLowerCase()));
  return (
    
    <div className="space-y-6" data-testid="coord-students">

    {/* Header */}
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
          Students
        </h1>

        <p className="text-sm text-muted-foreground mt-1">
          Create and manage student accounts.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">

        <Input
          placeholder="Search..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-64"
          data-testid="students-search"
        />

        <Button
          className="w-full sm:w-auto"
          data-testid="new-student"
        >
          + New Student
        </Button>

        <Button
          variant="outline"
          className="w-full sm:w-auto"
          data-testid="upload-students"
        >
          Upload Excel
        </Button>

      </div>

    </div>

    {/* Table */}

    <div className="rounded-xl border border-border bg-card overflow-x-auto">

      <table className="min-w-full text-sm">

        <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">

          <tr>
            <th className="p-4">Name</th>
            <th className="p-4">Email</th>
            <th className="p-4">Matric</th>
            <th className="p-4">Level</th>
            <th className="p-4"></th>
          </tr>

        </thead>

        <tbody className="divide-y divide-border">

          {filtered.map((s) => (

            <tr key={s.id} data-testid={`student-row-${s.id}`}>

              <td className="p-4 font-medium whitespace-nowrap">
                {s.name}
              </td>

              <td className="p-4 text-muted-foreground break-all">
                {s.email}
              </td>

              <td className="p-4 whitespace-nowrap">
                {s.matric_no || "—"}
              </td>

              <td className="p-4 whitespace-nowrap">
                {s.level || "—"}
              </td>

              <td className="p-4 text-right">

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => reset(s.id)}
                >
                  Reset Password
                </Button>

              </td>

            </tr>

          ))}

          {filtered.length === 0 && (
            <tr>
              <td
                colSpan="5"
                className="p-8 text-center text-muted-foreground"
              >
                No students found.
              </td>
            </tr>
          )}

        </tbody>

      </table>

      </div>

    </div>
  );
}
