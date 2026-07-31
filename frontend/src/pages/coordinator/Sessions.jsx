import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function CoordSessions() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
    active: true,
  });

  const load = useCallback(async () => {
    const r = await api.get("/sessions");
    setRows(r.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/sessions", form);
      toast.success("Session created");
      setForm({
        name: "",
        start_date: "",
        end_date: "",
        active: true,
      });
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  const activate = async (id) => {
    await api.patch(`/sessions/${id}/activate`);
    load();
  };

  const remove = async (id) => {
    if (!window.confirm("Delete session?")) return;
    await api.delete(`/sessions/${id}`);
    load();
  };

  return (
    <div className="space-y-6" data-testid="coord-sessions">

      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
        Academic Sessions
      </h1>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Create Session Form */}

        <form
          onSubmit={submit}
          className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4"
        >
          <h3 className="font-bold text-lg">
            Create Session
          </h3>

          <div>
            <Label>Name (e.g. 2025/2026)</Label>

            <Input
              required
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              data-testid="session-name"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

            <div>
              <Label>Start</Label>

              <Input
                required
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  setForm({
                    ...form,
                    start_date: e.target.value,
                  })
                }
                data-testid="session-start"
              />
            </div>

            <div>
              <Label>End</Label>

              <Input
                required
                type="date"
                value={form.end_date}
                onChange={(e) =>
                  setForm({
                    ...form,
                    end_date: e.target.value,
                  })
                }
                data-testid="session-end"
              />
            </div>

          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) =>
                setForm({
                  ...form,
                  active: e.target.checked,
                })
              }
            />

            Mark as active (deactivates others)
          </label>

          <Button
            type="submit"
            className="w-full sm:w-auto"
            data-testid="session-submit"
          >
            Create
          </Button>
        </form>

        {/* Sessions List */}

        <div className="rounded-xl border border-border bg-card divide-y divide-border">

          {rows.map((s) => (

            <div
              key={s.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div>

                <div className="font-semibold flex flex-wrap items-center gap-2">
                  {s.name}

                  {s.active && <Badge>Active</Badge>}
                </div>

                <div className="text-xs text-muted-foreground mt-1">
                  {s.start_date} → {s.end_date}
                </div>

              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">

                {!s.active && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => activate(s.id)}
                  >
                    Activate
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="destructive"
                  className="w-full sm:w-auto"
                  onClick={() => remove(s.id)}
                >
                  Delete
                </Button>

              </div>

            </div>

          ))}

          {rows.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No sessions yet.
            </div>
          )}

        </div>

      </div>

    </div>
  );
}