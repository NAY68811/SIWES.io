import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CoordStudents() {
  const [students, setStudents] = useState([]);
  const [q, setQ] = useState("");
  const emptyForm = {
    name: "",
    email: "",
    matric_no: "",
    phone: "",
    department_id: "",
    level: "400",
  };

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [depts, setDepts] = useState([]);
  const [tempCreds, setTempCreds] = useState(null);
  const load = async () => {
  const [studentRes, deptRes] = await Promise.all([
    api.get("/users?role=student"),
    api.get("/departments"),
    ]);

    setStudents(studentRes.data);
    setDepts(deptRes.data);
  };
    useEffect(() => { load(); }, []);
  const reset = async (id) => {
    try {
      const { data } = await api.patch(`/users/${id}/reset-password`, {});
      toast.success(`Reset. New password: ${data.new_password}`);
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };
  const upd = (key) => (value) =>
    setForm((f) => ({
      ...f,
      [key]: value?.target ? value.target.value : value,
    }));

  const openNew = () => {
    setForm(emptyForm);
    setTempCreds(null);
    setOpen(true);
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

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openNew}
              className="w-full sm:w-auto"
              data-testid="new-student"
            >
              + New Student
            </Button>
          </DialogTrigger>

          <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">

            <DialogHeader>
              <DialogTitle>Create Student</DialogTitle>

              <DialogDescription>
                A temporary password will be generated automatically.
              </DialogDescription>
            </DialogHeader>

            <form className="space-y-3">

              <div>
                <Label>Full Name</Label>
                <Input
                  required
                  value={form.name}
                  onChange={upd("name")}
                />
              </div>

              <div>
                <Label>Email</Label>
                <Input
                  required
                  type="email"
                  value={form.email}
                  onChange={upd("email")}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                <div>
                  <Label>Matric Number</Label>
                  <Input
                    required
                    value={form.matric_no}
                    onChange={upd("matric_no")}
                  />
                </div>

                <div>
                  <Label>Level</Label>

                  <Select
                    value={form.level}
                    onValueChange={upd("level")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                      <SelectItem value="300">300</SelectItem>
                      <SelectItem value="400">400</SelectItem>
                      <SelectItem value="500">500</SelectItem>
                    </SelectContent>

                  </Select>

                </div>

              </div>

              <div>
                <Label>Department</Label>

                <Select
                  value={form.department_id}
                  onValueChange={upd("department_id")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>

                  <SelectContent>

                    {depts.map((d) => (
                      <SelectItem
                        key={d.id}
                        value={d.id}
                      >
                        {d.name}
                      </SelectItem>
                    ))}

                  </SelectContent>

                </Select>

              </div>

              <div>
                <Label>Phone</Label>

                <Input
                  value={form.phone}
                  onChange={upd("phone")}
                />
              </div>

              <DialogFooter>

                <Button type="submit">
                  Create Student
                </Button>

              </DialogFooter>

            </form>

          </DialogContent>
        </Dialog>

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
