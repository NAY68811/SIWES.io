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
            "name": "nHub Foundation, Jos",  # keep same demo
            "address": "2nd Floor TAEN Business Complex Opposite former NITEL Office, Old Airport Junction, Jos, Plateau State, Nigeria.",
            "state": "Plateau", "lga": "Jos South",
            "latitude": 9.9042, "longitude": 8.8921,
            "industry": "Web Development",
        }
        r = s.post(f"{API}/companies", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "pending"

    def test_coordinator_approve_company(self):
        # First re-submit as student so it's pending
        ss, _ = _session("student")
        ss.post(f"{API}/companies", json={
            "name": "nHub Foundation, Jos",
            "address": "2nd Floor TAEN Business Complex Opposite former NITEL Office, Old Airport Junction, Jos, Plateau State, Nigeria.",
            "state": "Plateau", "latitude": 9.9042, "longitude": 8.8921,
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



# ---------------- ITERATION 2: user mgmt / temp password / RBAC ----------------
class TestUserManagement:
    def test_public_register_role_forced_to_student(self):
        email = f"TEST_pub_{uuid.uuid4().hex[:8]}@siwes.edu"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "Password@123",
            "name": "Attempted Sup", "role": "supervisor",  # should be ignored
        })
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "student"

    def test_coordinator_creates_supervisor_with_temp_pw(self):
        s, _ = _session("coordinator")
        email = f"TEST_sup_{uuid.uuid4().hex[:6]}@siwes.edu"
        r = s.post(f"{API}/users", json={
            "email": email, "name": "TEST New Sup", "role": "supervisor",
            "phone": "+2340000", "staff_id": "TST-01",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["role"] == "supervisor"
        assert body["must_change_password"] is True
        assert body.get("temporary_password", "").startswith("Temp@")

    def test_coordinator_cannot_create_coordinator_or_admin(self):
        s, _ = _session("coordinator")
        for bad in ("coordinator", "admin"):
            r = s.post(f"{API}/users", json={
                "email": f"TEST_{bad}_{uuid.uuid4().hex[:6]}@x.com",
                "name": "X", "role": bad,
            })
            assert r.status_code == 403, f"role={bad} got {r.status_code}"

    def test_admin_creates_coordinator_and_supervisor(self):
        s, _ = _session("admin")
        for role in ("coordinator", "supervisor"):
            email = f"TEST_{role}_{uuid.uuid4().hex[:6]}@siwes.edu"
            r = s.post(f"{API}/users", json={
                "email": email, "name": f"T {role}", "role": role,
            })
            assert r.status_code == 200, r.text
            assert r.json()["role"] == role
            assert r.json()["temporary_password"].startswith("Temp@")

    def test_admin_cannot_create_admin(self):
        s, _ = _session("admin")
        r = s.post(f"{API}/users", json={
            "email": f"TEST_ad_{uuid.uuid4().hex[:6]}@x.com",
            "name": "X", "role": "admin",
        })
        assert r.status_code == 403

    def test_coordinator_edit_and_delete_supervisor(self):
        s, _ = _session("coordinator")
        # create
        email = f"TEST_ed_{uuid.uuid4().hex[:6]}@siwes.edu"
        c = s.post(f"{API}/users", json={
            "email": email, "name": "Edit Me", "role": "supervisor",
        }).json()
        uid = c["id"]
        # edit
        r = s.put(f"{API}/users/{uid}", json={"name": "Edited Name", "phone": "+2341", "staff_id": "S9"})
        assert r.status_code == 200
        assert r.json()["name"] == "Edited Name"
        # coordinator cannot edit non-supervisor: try editing admin
        admins = s.get(f"{API}/users", params={"role": "admin"}).json()
        if admins:
            r2 = s.put(f"{API}/users/{admins[0]['id']}", json={"name": "no"})
            assert r2.status_code == 403
        # delete
        r3 = s.delete(f"{API}/users/{uid}")
        assert r3.status_code == 200

    def test_admin_cannot_delete_admin(self):
        s, _ = _session("admin")
        admins = s.get(f"{API}/users", params={"role": "admin"}).json()
        assert admins
        r = s.delete(f"{API}/users/{admins[0]['id']}")
        assert r.status_code == 403

    def test_reset_password_sets_must_change(self):
        s, _ = _session("coordinator")
        email = f"TEST_rp_{uuid.uuid4().hex[:6]}@siwes.edu"
        c = s.post(f"{API}/users", json={
            "email": email, "name": "ResetMe", "role": "supervisor",
        }).json()
        uid = c["id"]
        r = s.patch(f"{API}/users/{uid}/reset-password", json={})
        assert r.status_code == 200
        assert r.json()["new_password"].startswith("Temp@")
        # cleanup
        s.delete(f"{API}/users/{uid}")


class TestChangePassword:
    def test_change_password_flow(self):
        # create a new supervisor via coordinator
        sc, _ = _session("coordinator")
        email = f"TEST_cp_{uuid.uuid4().hex[:6]}@siwes.edu"
        created = sc.post(f"{API}/users", json={
            "email": email, "name": "CP User", "role": "supervisor",
        }).json()
        temp_pw = created["temporary_password"]
        uid = created["id"]

        # login as new supervisor
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": email, "password": temp_pw})
        assert r.status_code == 200
        assert r.json()["must_change_password"] is True

        # wrong current password
        rw = s.post(f"{API}/auth/change-password", json={
            "current_password": "WrongPass", "new_password": "NewPass@123"})
        assert rw.status_code == 400

        # correct
        rc = s.post(f"{API}/auth/change-password", json={
            "current_password": temp_pw, "new_password": "NewPass@123"})
        assert rc.status_code == 200

        me = s.get(f"{API}/auth/me").json()
        assert me["must_change_password"] is False

        # cleanup
        sc.delete(f"{API}/users/{uid}")


class TestAssessments:
    def test_assessment_flow_upsert_and_forbidden(self):
        # supervisor submits for allocated student
        sv, _ = _session("supervisor")
        sc, _ = _session("coordinator")
        students = sc.get(f"{API}/users", params={"role": "student"}).json()
        stu = next(u for u in students if u["email"] == "student@siwes.edu")

        r = sv.post(f"{API}/assessments", json={
            "student_id": stu["id"], "rating": 5,
            "punctuality": 4, "teamwork": 5, "technical_skill": 4,
            "feedback": "TEST_ Great work"
        })
        assert r.status_code == 200, r.text

        # upsert: second submit updates
        r2 = sv.post(f"{API}/assessments", json={
            "student_id": stu["id"], "rating": 3, "feedback": "TEST_ update"
        })
        assert r2.status_code == 200

        # student sees own
        ss, _ = _session("student")
        listing = ss.get(f"{API}/assessments/student/{stu['id']}").json()
        assert isinstance(listing, list) and len(listing) >= 1
        # after upsert only 1 record for this supervisor
        mine = [a for a in listing if a["supervisor_id"]]
        assert any(a["rating"] == 3 for a in mine)

        # supervisor forbidden for unallocated student: create fresh student
        email = f"TEST_std_{uuid.uuid4().hex[:6]}@siwes.edu"
        reg = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "Password@123", "name": "Unalloc"
        })
        new_stu_id = reg.json()["id"]
        rf = sv.post(f"{API}/assessments", json={
            "student_id": new_stu_id, "rating": 5
        })
        assert rf.status_code == 403


class TestSessions:
    def test_session_create_activate_delete(self):
        s, _ = _session("coordinator")
        # create active
        r = s.post(f"{API}/sessions", json={
            "name": f"TEST_{uuid.uuid4().hex[:4]}",
            "start_date": "2026-02-01", "end_date": "2026-08-01",
            "active": True
        })
        assert r.status_code == 200, r.text
        sid = r.json()["id"]

        # verify only one active
        listing = s.get(f"{API}/sessions").json()
        actives = [x for x in listing if x["active"]]
        assert len(actives) == 1 and actives[0]["id"] == sid

        # create another inactive
        r2 = s.post(f"{API}/sessions", json={
            "name": f"TEST_{uuid.uuid4().hex[:4]}",
            "start_date": "2026-02-01", "end_date": "2026-08-01",
            "active": False
        })
        sid2 = r2.json()["id"]

        # activate the second
        ra = s.patch(f"{API}/sessions/{sid2}/activate")
        assert ra.status_code == 200
        listing2 = s.get(f"{API}/sessions").json()
        actives2 = [x for x in listing2 if x["active"]]
        assert len(actives2) == 1 and actives2[0]["id"] == sid2

        # delete both
        assert s.delete(f"{API}/sessions/{sid}").status_code == 200
        assert s.delete(f"{API}/sessions/{sid2}").status_code == 200


class TestAuditLogs:
    def test_admin_can_list_audit_logs(self):
        s, _ = _session("admin")
        r = s.get(f"{API}/audit-logs")
        assert r.status_code == 200
        entries = r.json()
        assert isinstance(entries, list)
        actions = {e["action"] for e in entries}
        # should have at least some seed activity from previous tests
        assert any(a.startswith("user.create") or a == "assessment.submit"
                   or a == "auth.change_password" or a == "student.self_register"
                   for a in actions), actions

    def test_non_admin_cannot_list_audit_logs(self):
        for role in ("coordinator", "supervisor", "student"):
            s, _ = _session(role)
            r = s.get(f"{API}/audit-logs")
            assert r.status_code == 403, f"{role} got {r.status_code}"
