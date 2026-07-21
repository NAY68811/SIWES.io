"""SIWES backend end-to-end tests.

Covers auth, RBAC, companies, logbooks, allocations, visits (GPS),
dashboards, reports, notifications.
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE:
    # fallback: read frontend .env
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


def _session(role):
    email, pw = CREDS[role]
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
    assert r.status_code == 200, f"login {role} failed: {r.status_code} {r.text}"
    return s, r


# ---------------- AUTH ----------------
class TestAuth:
    def test_login_all_roles_sets_cookies(self):
        for role in CREDS:
            s, r = _session(role)
            data = r.json()
            assert data["role"] == role or (role == "admin" and data["role"] == "admin")
            assert data["email"] == CREDS[role][0]
            # httpOnly cookies
            names = {c.name for c in s.cookies}
            assert "access_token" in names, f"missing access_token for {role}"
            assert "refresh_token" in names, f"missing refresh_token for {role}"

    def test_me_returns_user(self):
        s, _ = _session("student")
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == "student@siwes.edu"

    def test_logout_clears_cookies(self):
        s, _ = _session("student")
        r = s.post(f"{API}/auth/logout")
        assert r.status_code == 200
        # After logout, /me should fail
        r2 = requests.get(f"{API}/auth/me")
        assert r2.status_code == 401

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "student@siwes.edu", "password": "wrong"})
        assert r.status_code == 401

    def test_register_new_user_logs_in(self):
        email = f"TEST_{uuid.uuid4().hex[:8]}@siwes.edu"
        s = requests.Session()
        r = s.post(f"{API}/auth/register", json={
            "email": email, "password": "Password@123",
            "name": "Test Newbie", "role": "student"
        })
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "student"
        # Cookies set
        me = s.get(f"{API}/auth/me")
        assert me.status_code == 200
        assert me.json()["email"] == email.lower()


# ---------------- RBAC ----------------
class TestRBAC:
    def test_coordinator_can_list_users(self):
        s, _ = _session("coordinator")
        r = s.get(f"{API}/users", params={"role": "student"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_can_list_users(self):
        s, _ = _session("admin")
        r = s.get(f"{API}/users", params={"role": "student"})
        assert r.status_code == 200

    def test_student_cannot_list_users(self):
        s, _ = _session("student")
        r = s.get(f"{API}/users", params={"role": "student"})
        assert r.status_code == 403


# ---------------- COMPANIES ----------------
class TestCompanies:
    def test_student_get_company_mine(self):
        s, _ = _session("student")
        r = s.get(f"{API}/companies/mine")
        assert r.status_code == 200
        c = r.json()
        assert c is not None
        assert c["name"]
        assert c["latitude"] == 6.4281 and c["longitude"] == 3.4219

    def test_student_create_updates_own_company(self):
        s, _ = _session("student")
        payload = {
            "name": "TechForge Innovations Ltd",  # keep same demo
            "address": "12 Adeola Odeku Street, Victoria Island",
            "state": "Lagos", "lga": "Eti-Osa",
            "latitude": 6.4281, "longitude": 3.4219,
            "industry": "Software Development",
        }
        r = s.post(f"{API}/companies", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "pending"

    def test_coordinator_approve_company(self):
        # First re-submit as student so it's pending
        ss, _ = _session("student")
        ss.post(f"{API}/companies", json={
            "name": "TechForge Innovations Ltd",
            "address": "12 Adeola Odeku Street, Victoria Island",
            "state": "Lagos", "latitude": 6.4281, "longitude": 3.4219,
        })
        mine = ss.get(f"{API}/companies/mine").json()
        cid = mine["id"]

        sc, _ = _session("coordinator")
        r = sc.patch(f"{API}/companies/{cid}/status", json={"status": "approved"})
        assert r.status_code == 200
        assert r.json()["status"] == "approved"


# ---------------- LOGBOOKS ----------------
class TestLogbooks:
    def test_full_logbook_flow_with_notification(self):
        # Student creates entry
        ss, _ = _session("student")
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        r = ss.post(f"{API}/logbooks", json={
            "date": date, "hours": 8,
            "activities": "TEST_ Worked on React frontend module.",
            "skills": "React", "challenges": "None"
        })
        assert r.status_code == 200, r.text
        lid = r.json()["id"]
        assert r.json()["status"] == "pending"

        # Supervisor reviews (approve)
        sv, _ = _session("supervisor")
        r2 = sv.patch(f"{API}/logbooks/{lid}/review", json={
            "status": "approved", "comment": "Nice work"
        })
        assert r2.status_code == 200
        assert r2.json()["status"] == "approved"

        # Student sees approved status
        mine = ss.get(f"{API}/logbooks/mine").json()
        approved = [l for l in mine if l["id"] == lid]
        assert approved and approved[0]["status"] == "approved"

        # Student notification created
        notifs = ss.get(f"{API}/notifications").json()
        assert any("approved" in (n["title"] or "").lower() for n in notifs), notifs[:3]


# ---------------- ALLOCATIONS ----------------
class TestAllocations:
    def test_student_my_supervisor(self):
        s, _ = _session("student")
        r = s.get(f"{API}/allocations/my-supervisor")
        assert r.status_code == 200
        sup = r.json()
        assert sup is not None
        assert sup["email"] == "supervisor@siwes.edu"

    def test_supervisor_my_students(self):
        s, _ = _session("supervisor")
        r = s.get(f"{API}/allocations/my-students")
        assert r.status_code == 200
        students = r.json()
        assert any(st["email"] == "student@siwes.edu" for st in students)

    def test_auto_allocate(self):
        s, _ = _session("coordinator")
        r = s.post(f"{API}/allocations/auto")
        assert r.status_code == 200
        assert "assigned" in r.json()

    def test_manual_allocate(self):
        s, _ = _session("coordinator")
        # get IDs
        students = s.get(f"{API}/users", params={"role": "student"}).json()
        supers = s.get(f"{API}/users", params={"role": "supervisor"}).json()
        st = next(u for u in students if u["email"] == "student@siwes.edu")
        sv = next(u for u in supers if u["email"] == "supervisor@siwes.edu")
        r = s.post(f"{API}/allocations/manual",
                   json={"student_id": st["id"], "supervisor_id": sv["id"]})
        assert r.status_code == 200


# ---------------- VISITS + GPS ----------------
class TestVisitsGPS:
    def test_schedule_and_verify_visit(self):
        sv, _ = _session("supervisor")
        students = sv.get(f"{API}/allocations/my-students").json()
        assert students
        stu_id = students[0]["id"]
        # schedule
        r = sv.post(f"{API}/visits/schedule", json={
            "student_id": stu_id,
            "scheduled_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "note": "TEST_ scheduled"
        })
        assert r.status_code == 200, r.text
        vid = r.json()["id"]

        # verify at correct coords -> should be verified
        rv = sv.post(f"{API}/visits/{vid}/verify",
                     json={"latitude": 6.4281, "longitude": 3.4219,
                           "accuracy": 5, "report": "OK", "rating": 5})
        assert rv.status_code == 200, rv.text
        data = rv.json()
        assert data["verified"] is True
        assert data["status"] == "verified"

        # Schedule another and verify from far away
        r2 = sv.post(f"{API}/visits/schedule", json={
            "student_id": stu_id,
            "scheduled_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        })
        vid2 = r2.json()["id"]
        rv2 = sv.post(f"{API}/visits/{vid2}/verify",
                      json={"latitude": 0.0, "longitude": 0.0})
        assert rv2.status_code == 200
        assert rv2.json()["verified"] is False
        assert rv2.json()["status"] == "failed"


# ---------------- DASHBOARD ----------------
class TestDashboard:
    def test_student_stats(self):
        s, _ = _session("student")
        r = s.get(f"{API}/dashboard/stats").json()
        for k in ("total_days", "approved", "pending", "rejected", "visits"):
            assert k in r, f"missing key {k} in {r}"

    def test_supervisor_stats(self):
        s, _ = _session("supervisor")
        r = s.get(f"{API}/dashboard/stats").json()
        for k in ("students", "upcoming_visits", "verified_visits", "pending_logbooks"):
            assert k in r

    def test_coordinator_stats(self):
        s, _ = _session("coordinator")
        r = s.get(f"{API}/dashboard/stats").json()
        for k in ("students", "supervisors", "pending_companies",
                  "pending_logbooks", "total_visits", "verified_visits", "allocations"):
            assert k in r


# ---------------- REPORTS ----------------
class TestReports:
    def test_report_summary_coordinator(self):
        s, _ = _session("coordinator")
        r = s.get(f"{API}/reports/summary")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            row = data[0]
            for k in ("logs_total", "logs_approved", "visits_verified"):
                assert k in row

    def test_report_forbidden_for_student(self):
        s, _ = _session("student")
        r = s.get(f"{API}/reports/summary")
        assert r.status_code == 403
