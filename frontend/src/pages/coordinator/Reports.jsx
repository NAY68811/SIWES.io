import { useEffect, useState } from "react";
import { api, API } from "@/lib/api";
import { Button } from "@/components/ui/button";

function toCSV(rows) {
  if (!rows.length) return "";
  const headers = ["Name", "Matric", "Email", "Logs total", "Logs approved", "Visits verified"];
  const lines = rows.map(r => [r.name, r.matric_no || "", r.email, r.logs_total, r.logs_approved, r.visits_verified]
    .map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","));
  return [headers.join(","), ...lines].join("\n");
}

export default function CoordReports() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/reports/summary").then(r => setRows(r.data)); }, []);
  const downloadCSV = () => {
    const blob = new Blob([toCSV(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "siwes-report.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  const downloadPDF = () => {
    window.open(`${API}/reports/summary.pdf`, "_blank");
  };
  return (
    <div className="space-y-6" data-testid="coord-reports">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">Reports</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadCSV} data-testid="download-csv">Download CSV</Button>
          <Button onClick={downloadPDF} data-testid="download-pdf">Download PDF</Button>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="p-4">Student</th><th className="p-4">Matric</th>
              <th className="p-4">Logs total</th><th className="p-4">Approved</th>
              <th className="p-4">Verified visits</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(r => (
              <tr key={r.id}>
                <td className="p-4 font-medium">{r.name}</td>
                <td className="p-4">{r.matric_no || "—"}</td>
                <td className="p-4">{r.logs_total}</td>
                <td className="p-4 text-emerald-500">{r.logs_approved}</td>
                <td className="p-4">{r.visits_verified}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-muted-foreground">No data yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
