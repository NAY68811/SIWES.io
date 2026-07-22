"""Iteration 3 tests: email, uploads, PDF, backup/restore."""
import base64
import io
import json
import os
import uuid

import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE}/api"

CREDS = {
    "admin": ("admin@siwes.edu", "Admin@1234"),
    "coordinator": ("coordinator@siwes.edu", "Password@123"),
    "supervisor": ("supervisor@siwes.edu", "Password@123"),
    "student": ("student@siwes.edu", "Password@123"),
}

TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
)


def _session(role):
    email, pw = CREDS[role]
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
    assert r.status_code == 200, f"login {role} failed: {r.status_code} {r.text}"
    return s


# ---------- EMAIL DELIVERY ----------
class TestEmailDelivery:
    def test_create_user_blocked_test_domain(self):
        """example.com should return email_sent=false but user still created + temp pw."""
        sc = _session("coordinator")
        email = f"TEST_es_{uuid.uuid4().hex[:6]}@example.com"
        r = sc.post(f"{API}/users", json={
            "email": email, "name": "TEST Blocked", "role": "supervisor",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("temporary_password", "").startswith("Temp@")
        assert "email_sent" in body
        assert body["email_sent"] is False
        # cleanup
        sc.delete(f"{API}/users/{body['id']}")

    def test_create_user_real_domain_email_sent_true(self):
        """Real domain (gmail.com) should return email_sent=true."""
        sc = _session("coordinator")
        email = f"real.sup+iter3_{uuid.uuid4().hex[:4]}@gmail.com"
        r = sc.post(f"{API}/users", json={
            "email": email, "name": "TEST Real Sup", "role": "supervisor",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("temporary_password", "").startswith("Temp@")
        assert body.get("email_sent") is True, f"expected email_sent True, got {body}"
        sc.delete(f"{API}/users/{body['id']}")


# ---------- UPLOADS ----------
class TestUploads:
    def _upload(self, s, scope, filename="a.png", data=TINY_PNG, content_type="image/png"):
        return s.post(
            f"{API}/uploads/{scope}",
            files={"file": (filename, io.BytesIO(data), content_type)},
        )

    def test_upload_logbook_returns_id_and_url(self):
        s = _session("student")
        r = self._upload(s, "logbook")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "id" in body and body["url"].startswith("/api/uploads/file/")
        assert body["content_type"] == "image/png"

    def test_upload_avatar_returns_id_and_url(self):
        s = _session("supervisor")
        r = self._upload(s, "avatar")
        assert r.status_code == 200, r.text
        assert r.json()["url"].startswith("/api/uploads/file/")

    def test_invalid_scope_returns_400(self):
        s = _session("student")
        r = self._upload(s, "hacker")
        assert r.status_code == 400

    def test_bad_extension_returns_400(self):
        s = _session("student")
        r = self._upload(s, "logbook", filename="bad.exe", content_type="application/octet-stream")
        assert r.status_code == 400

    def test_download_returns_bytes_with_content_type(self):
        s = _session("student")
        r = self._upload(s, "logbook")
        assert r.status_code == 200
        url = r.json()["url"]
        r2 = s.get(f"{BASE}{url}")
        assert r2.status_code == 200
        assert r2.headers["content-type"].startswith("image/png")
        assert r2.content == TINY_PNG

    def test_download_unauthenticated_401(self):
        s = _session("student")
        r = self._upload(s, "logbook")
        url = r.json()["url"]
        # fresh session — no cookies
        r2 = requests.get(f"{BASE}{url}")
        assert r2.status_code == 401


# ---------- PDF ----------
class TestPDF:
    def test_pdf_as_coordinator(self):
        s = _session("coordinator")
        r = s.get(f"{API}/reports/summary.pdf")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/pdf")
        assert "attachment" in r.headers.get("content-disposition", "").lower()
        assert r.content.startswith(b"%PDF")

    def test_pdf_as_admin(self):
        s = _session("admin")
        r = s.get(f"{API}/reports/summary.pdf")
        assert r.status_code == 200
        assert r.content.startswith(b"%PDF")

    def test_pdf_forbidden_student(self):
        s = _session("student")
        r = s.get(f"{API}/reports/summary.pdf")
        assert r.status_code == 403


# ---------- BACKUP / RESTORE ----------
class TestBackupRestore:
    def test_backup_as_admin(self):
        s = _session("admin")
        r = s.get(f"{API}/admin/backup")
        assert r.status_code == 200
        data = r.json()
        assert "created_at" in data
        assert "collections" in data
        cols = data["collections"]
        for name in ["users", "departments", "companies", "logbooks", "visits",
                     "allocations", "notifications", "assessments", "audit_logs",
                     "files", "gps_logs", "sessions"]:
            assert name in cols, f"missing collection {name}"

    def test_backup_forbidden_non_admin(self):
        for role in ("coordinator", "supervisor", "student"):
            s = _session(role)
            r = s.get(f"{API}/admin/backup")
            assert r.status_code == 403, f"{role} got {r.status_code}"

    def test_restore_invalid_json(self):
        s = _session("admin")
        r = s.post(
            f"{API}/admin/restore",
            files={"file": ("bad.json", io.BytesIO(b"not json"), "application/json")},
        )
        assert r.status_code == 400

    def test_restore_forbidden_non_admin(self):
        s = _session("coordinator")
        # send an empty valid JSON to prove it's blocked by RBAC before parsing
        payload = json.dumps({"collections": {}}).encode()
        r = s.post(
            f"{API}/admin/restore",
            files={"file": ("b.json", io.BytesIO(payload), "application/json")},
        )
        assert r.status_code == 403

    def test_backup_delete_restore_round_trip(self):
        """Backup → create disposable user → delete → restore → verify user is back."""
        sc = _session("coordinator")
        sa = _session("admin")

        # 1. Create a disposable supervisor
        email = f"TEST_rt_{uuid.uuid4().hex[:6]}@siwes.edu"
        cr = sc.post(f"{API}/users", json={
            "email": email, "name": "RoundTrip User", "role": "supervisor",
        })
        assert cr.status_code == 200, cr.text
        uid = cr.json()["id"]
        email_lc = email.lower()

        # 2. Backup
        rb = sa.get(f"{API}/admin/backup")
        assert rb.status_code == 200
        backup_json = rb.content

        # 3. Delete the user
        d = sc.delete(f"{API}/users/{uid}")
        assert d.status_code == 200
        # confirm gone
        users = sc.get(f"{API}/users", params={"role": "supervisor"}).json()
        assert not any(u["email"] == email_lc for u in users)

        # 4. Restore
        rr = sa.post(
            f"{API}/admin/restore",
            files={"file": ("b.json", io.BytesIO(backup_json), "application/json")},
        )
        assert rr.status_code == 200, rr.text
        assert "restored" in rr.json()
        assert rr.json()["restored"].get("users", 0) > 0

        # 5. Verify user is back
        # login again since cookies might be affected
        sc2 = _session("coordinator")
        users2 = sc2.get(f"{API}/users", params={"role": "supervisor"}).json()
        found = [u for u in users2 if u["email"] == email_lc]
        assert found, f"user {email_lc} not restored"

        # cleanup
        sc2.delete(f"{API}/users/{found[0]['id']}")
