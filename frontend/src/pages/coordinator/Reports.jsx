import { useEffect, useState } from "react";
import { api, API } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function toCSV(rows) {
  if (!rows.length) return "";

  const headers = [
    "Name",
    "Matric",
    "Email",
    "Logs total",
    "Logs approved",
    "Visits verified",
  ];

  const lines = rows.map((r) =>
    [
      r.name,
      r.matric_no || "",
      r.email,
      r.logs_total,
      r.logs_approved,
      r.visits_verified,
    ]
      .map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`)
      .join(",")
  );

  return [headers.join(","), ...lines].join("\n");
}

export default function CoordReports() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.get("/reports/summary").then((r) => setRows(r.data));
  }, []);

  const downloadCSV = () => {
    const blob = new Blob([toCSV(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "siwes-report.csv";
    a.click();

    URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    window.open(`${API}/reports/summary.pdf`, "_blank");
  };

  return (
    <div className="space-y-6 p-4 md:p-6" data-testid="coord-reports">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          Reports
        </h1>

        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <Button
            variant="outline"
            onClick={downloadCSV}
            className="w-full sm:w-auto"
            data-testid="download-csv"
          >
            Download CSV
          </Button>

          <Button
            onClick={downloadPDF}
            className="w-full sm:w-auto"
            data-testid="download-pdf"
          >
            Download PDF
          </Button>
        </div>
      </div>

      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No report data available.
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden lg:block rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="p-4">Student</th>
              <th className="p-4">Matric</th>
              <th className="p-4">Logs Total</th>
              <th className="p-4">Approved</th>
              <th className="p-4">Verified Visits</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-4 font-medium">{r.name}</td>
                <td className="p-4">{r.matric_no || "—"}</td>
                <td className="p-4">{r.logs_total}</td>
                <td className="p-4 text-emerald-600 font-semibold">
                  {r.logs_approved}
                </td>
                <td className="p-4">{r.visits_verified}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-4">
        {rows.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{r.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {r.matric_no || "No Matric Number"}
                </p>
              </div>

              <Badge variant="secondary">
                {r.visits_verified} Visits
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Total Logs</div>
                <div className="font-semibold">{r.logs_total}</div>
              </div>

              <div>
                <div className="text-muted-foreground">Approved</div>
                <div className="font-semibold text-emerald-600">
                  {r.logs_approved}
                </div>
              </div>

              <div className="col-span-2">
                <div className="text-muted-foreground">
                  Verified Visits
                </div>
                <div className="font-semibold">
                  {r.visits_verified}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}