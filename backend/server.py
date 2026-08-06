"""SIWES Supervisor Allocation System — FastAPI backend."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import math
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal, Any

import bcrypt
from jose import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query, UploadFile, File, Header
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, ConfigDict

from services.email_service import send_email, credentials_email_html
from services import storage_service

# ---------- Setup ----------
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("siwes")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
GPS_RADIUS_METERS = int(os.environ.get("GPS_RADIUS_METERS", "150"))

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="SIWES Supervisor Allocation API")
api = APIRouter(prefix="/api")

Role = Literal["student", "supervisor", "coordinator", "admin"]

# ---------- Helpers ----------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def iso(dt: datetime) -> str:
    return dt.isoformat()

def oid_str(v: Any) -> str:
    return str(v) if isinstance(v, ObjectId) else v

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def make_access(user_id: str, role: str) -> str:
    return jwt.encode(
        {"sub": user_id, "role": role, "type": "access",
         "exp": now_utc() + timedelta(minutes=60)},
        JWT_SECRET, algorithm=JWT_ALG)

def make_refresh(user_id: str) -> str:
    return jwt.encode(
        {"sub": user_id, "type": "refresh",
         "exp": now_utc() + timedelta(days=7)},
        JWT_SECRET, algorithm=JWT_ALG)

def set_auth_cookies(resp: Response, access: str, refresh: str) -> None:
    resp.set_cookie("access_token", access, httponly=True, secure=True, 
                    samesite="none", max_age=3600, path="/")

    resp.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                    samesite="none", max_age=604800, path="/")


def clear_auth_cookies(resp: Response) -> None:
    resp.delete_cookie("access_token", path="/")
    resp.delete_cookie("refresh_token", path="/")

def serialize_user(u: dict) -> dict:
    return {
        "id": oid_str(u.get("_id")),
        "email": u["email"],
        "name": u.get("name"),
        "role": u["role"],
        "phone": u.get("phone"),
        "avatar": u.get("avatar"),
        "department_id": oid_str(u.get("department_id")) if u.get("department_id") else None,
        "matric_no": u.get("matric_no"),
        "staff_id": u.get("staff_id"),
        "level": u.get("level"),
        "must_change_password": bool(u.get("must_change_password", False)),
        "created_at": u.get("created_at"),
    }

async def audit(actor_id, action: str, target: str = "", meta: dict = None):
    """Append an audit log record for admin review."""
    await db.audit_logs.insert_one({
        "actor_id": actor_id, "action": action, "target": target,
        "meta": meta or {}, "created_at": iso(now_utc()),
    })

def haversine_m(lat1, lon1, lat2, lon2) -> float:
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1); dl = math.radians(lon2 - lon1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(a))

# ---------- Auth Dependency ----------
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")

    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]

    if not token:
        raise HTTPException(401, "Not authenticated")

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])

        if payload.get("type") != "access":
            raise HTTPException(401, "Invalid token type")

        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})

        if not user:
            raise HTTPException(401, "User not found")

        return user

    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")

    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

def require_roles(*roles: str):
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(403, f"Requires role: {', '.join(roles)}")
        return user
    return _dep

# ---------- Pydantic Models ----------
class RegisterIn(BaseModel):
    """Public self-registration is restricted to students only."""
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    phone: Optional[str] = None
    matric_no: Optional[str] = None
    department_id: Optional[str] = None
    level: Optional[str] = None

class AdminCreateUserIn(BaseModel):
    """Coordinator creates supervisors; Admin creates coordinators/supervisors."""
    email: EmailStr
    name: str
    role: Role
    phone: Optional[str] = None
    staff_id: Optional[str] = None
    department_id: Optional[str] = None

class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class DepartmentIn(BaseModel):
    name: str
    code: str
    faculty: Optional[str] = None

class SessionIn(BaseModel):
    name: str  # e.g. "2025/2026"
    start_date: str
    end_date: str
    active: bool = True

class CompanyIn(BaseModel):
    name: str
    address: str
    state: str
    lga: Optional[str] = None
    latitude: float
    longitude: float
    industry: Optional[str] = None
    supervisor_name: Optional[str] = None
    supervisor_phone: Optional[str] = None
    supervisor_email: Optional[str] = None

class LogbookIn(BaseModel):
    date: str
    hours: float
    activities: str
    skills: Optional[str] = None
    challenges: Optional[str] = None
    image_url: Optional[str] = None

class LogbookReview(BaseModel):
    status: Literal["approved", "rejected"]
    comment: Optional[str] = None

class VisitScheduleIn(BaseModel):
    student_id: str
    scheduled_date: str
    note: Optional[str] = None

class VisitVerifyIn(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    report: Optional[str] = None
    rating: Optional[int] = None

class AllocationManual(BaseModel):
    student_id: str
    supervisor_id: str

class AssessmentIn(BaseModel):
    student_id: str
    rating: int = Field(ge=1, le=5)
    punctuality: Optional[int] = Field(default=None, ge=1, le=5)
    teamwork: Optional[int] = Field(default=None, ge=1, le=5)
    technical_skill: Optional[int] = Field(default=None, ge=1, le=5)
    feedback: Optional[str] = None

# ---------- Startup ----------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.companies.create_index("student_id")
    await db.logbooks.create_index([("student_id", 1), ("date", -1)])
    await db.visits.create_index("supervisor_id")
    await db.visits.create_index("student_id")
    await db.allocations.create_index("student_id", unique=True)
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.assessments.create_index([("student_id", 1), ("supervisor_id", 1)], unique=True)
    await db.audit_logs.create_index([("created_at", -1)])
    await db.files.create_index("owner_id")
    storage_service.init_storage()
    await seed_defaults()
    logger.info("SIWES backend ready.")

async def seed_defaults():
    # Seed departments
    if await db.departments.count_documents({}) == 0:
        await db.departments.insert_many([
            {"name": "Computer Science", "code": "CSC", "faculty": "Science", "created_at": iso(now_utc())},
            {"name": "Electrical Engineering", "code": "EEE", "faculty": "Engineering", "created_at": iso(now_utc())},
            {"name": "Mechanical Engineering", "code": "MEE", "faculty": "Engineering", "created_at": iso(now_utc())},
            {"name": "Information Technology", "code": "IFT", "faculty": "Science", "created_at": iso(now_utc())},
        ])
    if await db.sessions.count_documents({}) == 0:
        await db.sessions.insert_one({
            "name": "2025/2026", "start_date": "2026-01-15", "end_date": "2026-07-15",
            "active": True, "created_at": iso(now_utc()),
        })

    dept_csc = await db.departments.find_one({"code": "CSC"})
    dept_id = dept_csc["_id"] if dept_csc else None

    async def ensure_user(email, password, name, role, extra=None):
        u = await db.users.find_one({"email": email})
        if u:
            if not verify_password(password, u["password_hash"]):
                await db.users.update_one({"_id": u["_id"]},
                    {"$set": {"password_hash": hash_password(password)}})
            return u
        doc = {
            "email": email, "password_hash": hash_password(password),
            "name": name, "role": role,
            "created_at": iso(now_utc()),
        }
        if extra: doc.update(extra)
        r = await db.users.insert_one(doc)
        doc["_id"] = r.inserted_id
        return doc

    await ensure_user(os.environ.get("ADMIN_EMAIL", "admin@siwes.edu"),
                      os.environ.get("ADMIN_PASSWORD", "Admin@1234"),
                      "System Admin", "admin")
    await ensure_user("coordinator@siwes.edu", "Password@123",
                      "Dr. Fatima Coordinator", "coordinator",
                      {"phone": "+2348024049342", "department_id": dept_id})
    sup = await ensure_user("supervisor@siwes.edu", "Password@123",
                      "Dr. Ben Supervisor", "supervisor",
                      {"phone": "+2348024049342", "staff_id": "STF-001",
                       "department_id": dept_id, "capacity": 10})
    stu = await ensure_user("student@siwes.edu", "Password@123",
                      "Yusuf Student", "student",
                      {"phone": "+2348068811750", "matric_no": "20/5543U/1",
                       "department_id": dept_id, "level": "400"})
    # ensure demo allocation
    await db.allocations.update_one(
        {"student_id": stu["_id"]},
        {"$setOnInsert": {
            "student_id": stu["_id"], "supervisor_id": sup["_id"],
            "assigned_at": iso(now_utc()), "assigned_by": "auto",
        }},
        upsert=True,
    )
    # ensure demo company
    if not await db.companies.find_one({"student_id": stu["_id"]}):
        await db.companies.insert_one({
            "student_id": stu["_id"],
            "name": "nHub Foundation, Jos",
            "address": "2nd Floor TAEN Business Complex Opposite former NITEL Office, Old Airport Junction, Jos, Plateau State, Nigeria.",
            "state": "Plateau", "lga": "Jos South",
            "latitude": 9.9042, "longitude": 8.8921,
            "industry": "Web Development",
            "supervisor_name": "Mr. Bashir Sheidu",
            "supervisor_phone": "+2348099999999",
            "supervisor_email": "contact@nhubfoundations.org",
            "status": "approved",
            "created_at": iso(now_utc()),
        })

@app.on_event("shutdown")
async def shutdown():
    client.close()

# ---------- Auth Endpoints ----------
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    doc = {
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": "student",  # public self-registration is always student
        "phone": body.phone,
        "matric_no": body.matric_no,
        "level": body.level,
        "must_change_password": False,
        "created_at": iso(now_utc()),
    }
    if body.department_id:
        try: doc["department_id"] = ObjectId(body.department_id)
        except Exception: pass
    r = await db.users.insert_one(doc)
    uid = str(r.inserted_id)
    set_auth_cookies(response, make_access(uid, "student"), make_refresh(uid))
    doc["_id"] = r.inserted_id
    await audit(r.inserted_id, "student.self_register", email)
    return serialize_user(doc)

@api.post("/auth/change-password")
async def change_password(body: ChangePasswordIn, user: dict = Depends(get_current_user)):
    if not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(400, "Current password is incorrect")
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": hash_password(body.new_password),
                  "must_change_password": False}})
    await audit(user["_id"], "auth.change_password")
    return {"ok": True}

@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    user = await db.users.find_one({"email": body.email.lower()})

    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")

    uid = str(user["_id"])
    set_auth_cookies(response, make_access(uid, user["role"]), make_refresh(uid))
    return serialize_user(user)


@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return serialize_user(user)

# ---------- Departments / Sessions ----------
@api.get("/departments")
async def list_departments():
    out = []
    async for d in db.departments.find():
        out.append({"id": str(d["_id"]), "name": d["name"], "code": d.get("code"), "faculty": d.get("faculty")})
    return out

@api.post("/departments")
async def create_department(body: DepartmentIn,
                            user: dict = Depends(require_roles("coordinator", "admin"))):
    r = await db.departments.insert_one({**body.model_dump(), "created_at": iso(now_utc())})
    return {"id": str(r.inserted_id), **body.model_dump()}

@api.get("/sessions")
async def list_sessions():
    out = []
    async for s in db.sessions.find():
        out.append({"id": str(s["_id"]), "name": s["name"],
                    "start_date": s["start_date"], "end_date": s["end_date"],
                    "active": s.get("active", False)})
    return out

@api.post("/sessions")
async def create_session(body: SessionIn,
                         user: dict = Depends(require_roles("coordinator", "admin"))):
    if body.active:
        await db.sessions.update_many({}, {"$set": {"active": False}})
    r = await db.sessions.insert_one({**body.model_dump(), "created_at": iso(now_utc())})
    return {"id": str(r.inserted_id), **body.model_dump()}

@api.patch("/sessions/{sid}/activate")
async def activate_session(sid: str,
                           user: dict = Depends(require_roles("coordinator", "admin"))):
    await db.sessions.update_many({}, {"$set": {"active": False}})
    await db.sessions.update_one({"_id": ObjectId(sid)}, {"$set": {"active": True}})
    return {"ok": True}

@api.delete("/sessions/{sid}")
async def delete_session(sid: str,
                         user: dict = Depends(require_roles("coordinator", "admin"))):
    await db.sessions.delete_one({"_id": ObjectId(sid)})
    return {"ok": True}

# ---------- Users management ----------
def _can_create_role(actor_role: str, target_role: str) -> bool:
    if actor_role == "admin":
        return target_role in ("coordinator", "supervisor")
    if actor_role == "coordinator":
        return target_role == "supervisor"
    return False

@api.get("/users")
async def list_users(role: Optional[str] = None,
                     user: dict = Depends(require_roles("coordinator", "admin"))):
    q = {"role": role} if role else {}
    return [serialize_user(u) async for u in db.users.find(q).sort("created_at", -1)]

@api.post("/users")
async def create_user(body: AdminCreateUserIn,
                      user: dict = Depends(require_roles("coordinator", "admin"))):
    """Coordinator creates supervisors. Admin creates coordinators or supervisors.
    A temporary password is generated and returned once; user must change it on first login."""
    if not _can_create_role(user["role"], body.role):
        raise HTTPException(403, f"{user['role']} cannot create role '{body.role}'")
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already exists")
    temp_password = f"Temp@{secrets.token_hex(4)}"
    doc = {
        "email": email,
        "password_hash": hash_password(temp_password),
        "name": body.name, "role": body.role,
        "phone": body.phone, "staff_id": body.staff_id,
        "must_change_password": True,
        "created_at": iso(now_utc()),
    }
    if body.department_id:
        try: doc["department_id"] = ObjectId(body.department_id)
        except Exception: pass
    r = await db.users.insert_one(doc)
    await audit(user["_id"], f"user.create.{body.role}", email)
    # Send credentials email (fire-and-forget — surface temp password inline as fallback)
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    email_sent = await send_email(
        recipient=email,
        subject=f"Your SIWES.io {body.role} account is ready",
        html=credentials_email_html(body.name, email, temp_password, body.role, f"{frontend_url}/login"),
    )
    return {**serialize_user({**doc, "_id": r.inserted_id}),
            "temporary_password": temp_password,
            "email_sent": email_sent}

@api.put("/users/{uid}")
async def edit_user(uid: str, body: dict,
                    user: dict = Depends(require_roles("coordinator", "admin"))):
    target = await db.users.find_one({"_id": ObjectId(uid)})
    if not target:
        raise HTTPException(404, "User not found")
    # Coordinators can only edit supervisors
    if user["role"] == "coordinator" and target["role"] != "supervisor":
        raise HTTPException(403, "Coordinators can only edit supervisors")
    allowed = {"name", "phone", "staff_id", "department_id", "level", "matric_no"}
    update = {k: v for k, v in body.items() if k in allowed}
    if "department_id" in update and update["department_id"]:
        try: update["department_id"] = ObjectId(update["department_id"])
        except Exception: update.pop("department_id")
    if update:
        await db.users.update_one({"_id": target["_id"]}, {"$set": update})
    await audit(user["_id"], "user.edit", target["email"], {"fields": list(update.keys())})
    fresh = await db.users.find_one({"_id": target["_id"]})
    return serialize_user(fresh)

@api.delete("/users/{uid}")
async def delete_user(uid: str, user: dict = Depends(require_roles("coordinator", "admin"))):
    target = await db.users.find_one({"_id": ObjectId(uid)})
    if not target:
        raise HTTPException(404, "User not found")
    if user["role"] == "coordinator" and target["role"] != "supervisor":
        raise HTTPException(403, "Coordinators can only delete supervisors")
    if target["role"] == "admin":
        raise HTTPException(403, "Admin accounts cannot be deleted via API")
    await db.users.delete_one({"_id": target["_id"]})
    await audit(user["_id"], "user.delete", target["email"])
    return {"ok": True}

@api.patch("/users/{uid}/reset-password")
async def reset_password(uid: str, body: dict,
                         user: dict = Depends(require_roles("coordinator", "admin"))):
    target = await db.users.find_one({"_id": ObjectId(uid)})
    if not target:
        raise HTTPException(404, "User not found")
    if user["role"] == "coordinator" and target["role"] not in ("supervisor", "student"):
        raise HTTPException(403, "Not permitted")
    new_pw = body.get("password") or f"Temp@{secrets.token_hex(4)}"
    await db.users.update_one({"_id": target["_id"]},
        {"$set": {"password_hash": hash_password(new_pw),
                  "must_change_password": True}})
    await audit(user["_id"], "user.reset_password", target["email"])
    return {"ok": True, "new_password": new_pw}

@api.patch("/users/me")
async def update_profile(body: dict, user: dict = Depends(get_current_user)):
    allowed = {"name", "phone", "avatar", "matric_no", "staff_id", "level"}
    update = {k: v for k, v in body.items() if k in allowed}
    if update:
        await db.users.update_one({"_id": user["_id"]}, {"$set": update})
    fresh = await db.users.find_one({"_id": user["_id"]})
    return serialize_user(fresh)

# ---------- Companies ----------
def serialize_company(c: dict) -> dict:
    return {
        "id": str(c["_id"]),
        "student_id": str(c["student_id"]),
        "name": c["name"], "address": c["address"], "state": c["state"],
        "lga": c.get("lga"),
        "latitude": c["latitude"], "longitude": c["longitude"],
        "industry": c.get("industry"),
        "supervisor_name": c.get("supervisor_name"),
        "supervisor_phone": c.get("supervisor_phone"),
        "supervisor_email": c.get("supervisor_email"),
        "status": c.get("status", "pending"),
        "created_at": c.get("created_at"),
    }

@api.post("/companies")
async def create_company(body: CompanyIn, user: dict = Depends(require_roles("student"))):
    existing = await db.companies.find_one({"student_id": user["_id"]})
    doc = {**body.model_dump(), "student_id": user["_id"],
           "status": "pending", "created_at": iso(now_utc())}
    if existing:
        await db.companies.update_one({"_id": existing["_id"]}, {"$set": doc})
        c = await db.companies.find_one({"_id": existing["_id"]})
    else:
        r = await db.companies.insert_one(doc)
        c = await db.companies.find_one({"_id": r.inserted_id})
    return serialize_company(c)

@api.get("/companies/mine")
async def my_company(user: dict = Depends(require_roles("student"))):
    c = await db.companies.find_one({"student_id": user["_id"]})
    return serialize_company(c) if c else None

@api.get("/companies")
async def list_companies(status: Optional[str] = None,
                         user: dict = Depends(require_roles("coordinator", "supervisor", "admin"))):
    q = {"status": status} if status else {}
    return [serialize_company(c) async for c in db.companies.find(q).sort("created_at", -1)]

@api.get("/companies/student/{student_id}")
async def get_company_by_student(student_id: str, user: dict = Depends(get_current_user)):
    c = await db.companies.find_one({"student_id": ObjectId(student_id)})
    return serialize_company(c) if c else None

@api.patch("/companies/{cid}/status")
async def approve_company(cid: str, body: dict,
                          user: dict = Depends(require_roles("coordinator", "admin"))):
    status = body.get("status", "approved")
    await db.companies.update_one({"_id": ObjectId(cid)}, {"$set": {"status": status}})
    c = await db.companies.find_one({"_id": ObjectId(cid)})
    # notify student
    await db.notifications.insert_one({
        "user_id": c["student_id"], "title": f"Company {status}",
        "body": f"Your company '{c['name']}' has been {status}.",
        "read": False, "created_at": iso(now_utc())})
    return serialize_company(c)

# ---------- Logbook ----------
def serialize_log(l: dict) -> dict:
    return {
        "id": str(l["_id"]),
        "student_id": str(l["student_id"]),
        "date": l["date"], "hours": l["hours"],
        "activities": l["activities"], "skills": l.get("skills"),
        "challenges": l.get("challenges"), "image_url": l.get("image_url"),
        "status": l.get("status", "pending"),
        "comment": l.get("comment"),
        "reviewed_at": l.get("reviewed_at"),
        "created_at": l.get("created_at"),
    }

@api.post("/logbooks")
async def create_log(body: LogbookIn, user: dict = Depends(require_roles("student"))):
    doc = {**body.model_dump(), "student_id": user["_id"],
           "status": "pending", "created_at": iso(now_utc())}
    r = await db.logbooks.insert_one(doc)
    doc["_id"] = r.inserted_id
    # notify supervisor
    alloc = await db.allocations.find_one({"student_id": user["_id"]})
    if alloc:
        await db.notifications.insert_one({
            "user_id": alloc["supervisor_id"], "title": "New logbook entry",
            "body": f"{user['name']} submitted a new entry for {body.date}.",
            "read": False, "created_at": iso(now_utc())})
    return serialize_log(doc)

@api.get("/logbooks/mine")
async def my_logs(user: dict = Depends(require_roles("student"))):
    return [serialize_log(l) async for l in
            db.logbooks.find({"student_id": user["_id"]}).sort("date", -1)]

@api.get("/logbooks/student/{sid}")
async def logs_by_student(sid: str, user: dict = Depends(get_current_user)):
    return [serialize_log(l) async for l in
            db.logbooks.find({"student_id": ObjectId(sid)}).sort("date", -1)]

@api.put("/logbooks/{lid}")
async def update_log(lid: str, body: LogbookIn, user: dict = Depends(require_roles("student"))):
    l = await db.logbooks.find_one({"_id": ObjectId(lid)})
    if not l or l["student_id"] != user["_id"]:
        raise HTTPException(404, "Not found")
    if l.get("status") == "approved":
        raise HTTPException(400, "Cannot edit approved entry")
    await db.logbooks.update_one({"_id": ObjectId(lid)},
                                 {"$set": {**body.model_dump(), "status": "pending"}})
    l = await db.logbooks.find_one({"_id": ObjectId(lid)})
    return serialize_log(l)

@api.patch("/logbooks/{lid}/review")
async def review_log(lid: str, body: LogbookReview,
                     user: dict = Depends(require_roles("supervisor"))):
    l = await db.logbooks.find_one({"_id": ObjectId(lid)})
    if not l: raise HTTPException(404, "Not found")
    await db.logbooks.update_one({"_id": ObjectId(lid)},
        {"$set": {"status": body.status, "comment": body.comment,
                  "reviewed_at": iso(now_utc()), "reviewer_id": user["_id"]}})
    await db.notifications.insert_one({
        "user_id": l["student_id"],
        "title": f"Logbook {body.status}",
        "body": body.comment or f"Your entry for {l['date']} was {body.status}.",
        "read": False, "created_at": iso(now_utc())})
    fresh = await db.logbooks.find_one({"_id": ObjectId(lid)})
    return serialize_log(fresh)

# ---------- Allocations ----------
@api.get("/allocations/my-supervisor")
async def my_supervisor(user: dict = Depends(require_roles("student"))):
    a = await db.allocations.find_one({"student_id": user["_id"]})
    if not a: return None
    sup = await db.users.find_one({"_id": a["supervisor_id"]})
    return serialize_user(sup) if sup else None

@api.get("/allocations/my-students")
async def my_students(user: dict = Depends(require_roles("supervisor"))):
    out = []
    async for a in db.allocations.find({"supervisor_id": user["_id"]}):
        s = await db.users.find_one({"_id": a["student_id"]})
        if s:
            c = await db.companies.find_one({"student_id": s["_id"]})
            out.append({**serialize_user(s),
                        "company": serialize_company(c) if c else None})
    return out

@api.get("/allocations")
async def list_allocations(user: dict = Depends(require_roles("coordinator", "admin"))):
    out = []
    async for a in db.allocations.find():
        s = await db.users.find_one({"_id": a["student_id"]})
        sup = await db.users.find_one({"_id": a["supervisor_id"]})
        out.append({
            "id": str(a["_id"]),
            "student": serialize_user(s) if s else None,
            "supervisor": serialize_user(sup) if sup else None,
            "assigned_by": a.get("assigned_by", "auto"),
            "assigned_at": a.get("assigned_at"),
        })
    return out

@api.post("/allocations/auto")
async def auto_allocate(user: dict = Depends(require_roles("coordinator", "admin"))):
    supervisors = [s async for s in db.users.find({"role": "supervisor"})]
    if not supervisors:
        raise HTTPException(400, "No supervisors available")
    # count current load
    load = {}
    for s in supervisors:
        load[str(s["_id"])] = await db.allocations.count_documents({"supervisor_id": s["_id"]})
    students = [s async for s in db.users.find({"role": "student"})]
    assigned = 0
    for st in students:
        existing = await db.allocations.find_one({"student_id": st["_id"]})
        if existing: continue
        # pick supervisor with same dept if possible, else min load
        candidates = [s for s in supervisors
                      if not st.get("department_id")
                      or s.get("department_id") == st.get("department_id")] or supervisors
        pick = min(candidates, key=lambda s: load.get(str(s["_id"]), 0))
        await db.allocations.insert_one({
            "student_id": st["_id"], "supervisor_id": pick["_id"],
            "assigned_at": iso(now_utc()), "assigned_by": "auto",
        })
        load[str(pick["_id"])] = load.get(str(pick["_id"]), 0) + 1
        assigned += 1
        await db.notifications.insert_one({
            "user_id": st["_id"], "title": "Supervisor assigned",
            "body": f"{pick['name']} has been assigned as your SIWES supervisor.",
            "read": False, "created_at": iso(now_utc())})
    return {"assigned": assigned}

@api.post("/allocations/manual")
async def manual_allocate(body: AllocationManual,
                          user: dict = Depends(require_roles("coordinator", "admin"))):
    sid = ObjectId(body.student_id); vid = ObjectId(body.supervisor_id)
    await db.allocations.update_one(
        {"student_id": sid},
        {"$set": {"supervisor_id": vid, "assigned_at": iso(now_utc()),
                  "assigned_by": "manual"},
         "$setOnInsert": {"student_id": sid}}, upsert=True)
    await db.notifications.insert_one({
        "user_id": sid, "title": "Supervisor updated",
        "body": "A supervisor has been assigned to you.",
        "read": False, "created_at": iso(now_utc())})
    return {"ok": True}

# ---------- Visits ----------
def serialize_visit(v: dict) -> dict:
    return {
        "id": str(v["_id"]),
        "supervisor_id": str(v["supervisor_id"]),
        "student_id": str(v["student_id"]),
        "scheduled_date": v.get("scheduled_date"),
        "status": v.get("status", "scheduled"),
        "note": v.get("note"),
        "gps": v.get("gps"),
        "distance_m": v.get("distance_m"),
        "report": v.get("report"),
        "rating": v.get("rating"),
        "verified_at": v.get("verified_at"),
        "created_at": v.get("created_at"),
    }

@api.post("/visits/schedule")
async def schedule_visit(body: VisitScheduleIn,
                         user: dict = Depends(require_roles("supervisor"))):
    doc = {"supervisor_id": user["_id"],
           "student_id": ObjectId(body.student_id),
           "scheduled_date": body.scheduled_date,
           "note": body.note, "status": "scheduled",
           "created_at": iso(now_utc())}
    r = await db.visits.insert_one(doc)
    doc["_id"] = r.inserted_id
    await db.notifications.insert_one({
        "user_id": ObjectId(body.student_id),
        "title": "Visit scheduled",
        "body": f"{user['name']} scheduled a visit on {body.scheduled_date}.",
        "read": False, "created_at": iso(now_utc())})
    return serialize_visit(doc)

@api.post("/visits/{vid}/verify")
async def verify_visit(vid: str, body: VisitVerifyIn,
                       user: dict = Depends(require_roles("supervisor"))):
    v = await db.visits.find_one({"_id": ObjectId(vid)})
    if not v: raise HTTPException(404, "Visit not found")
    if v["supervisor_id"] != user["_id"]:
        raise HTTPException(403, "Not your visit")
    company = await db.companies.find_one({"student_id": v["student_id"]})
    if not company:
        raise HTTPException(400, "Student has no registered company")
    dist = haversine_m(body.latitude, body.longitude,
                       company["latitude"], company["longitude"])
    verified = dist <= GPS_RADIUS_METERS
    upd = {
        "gps": {"latitude": body.latitude, "longitude": body.longitude,
                "accuracy": body.accuracy},
        "distance_m": round(dist, 2),
        "status": "verified" if verified else "failed",
        "report": body.report, "rating": body.rating,
        "verified_at": iso(now_utc()),
    }
    await db.visits.update_one({"_id": ObjectId(vid)}, {"$set": upd})
    # log GPS attempt
    await db.gps_logs.insert_one({
        "visit_id": ObjectId(vid), "supervisor_id": user["_id"],
        "student_id": v["student_id"], "verified": verified,
        "distance_m": round(dist, 2), "latitude": body.latitude,
        "longitude": body.longitude, "accuracy": body.accuracy,
        "created_at": iso(now_utc())})
    if verified:
        await db.notifications.insert_one({
            "user_id": v["student_id"], "title": "Visit verified",
            "body": f"{user['name']} completed a verified visit today.",
            "read": False, "created_at": iso(now_utc())})
    v = await db.visits.find_one({"_id": ObjectId(vid)})
    result = serialize_visit(v)
    result["verified"] = verified
    result["radius_m"] = GPS_RADIUS_METERS
    return result

@api.get("/visits/mine")
async def my_visits(user: dict = Depends(get_current_user)):
    q = {"supervisor_id": user["_id"]} if user["role"] == "supervisor" \
        else {"student_id": user["_id"]}
    return [serialize_visit(v) async for v in db.visits.find(q).sort("created_at", -1)]

@api.get("/visits")
async def all_visits(user: dict = Depends(require_roles("coordinator", "admin"))):
    return [serialize_visit(v) async for v in db.visits.find().sort("created_at", -1)]

# ---------- Notifications ----------
@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    out = []
    async for n in db.notifications.find({"user_id": user["_id"]}).sort("created_at", -1).limit(50):
        out.append({"id": str(n["_id"]), "title": n["title"], "body": n["body"],
                    "read": n.get("read", False), "created_at": n["created_at"]})
    return out

@api.patch("/notifications/{nid}/read")
async def mark_read(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"_id": ObjectId(nid), "user_id": user["_id"]},
        {"$set": {"read": True}})
    return {"ok": True}

@api.patch("/notifications/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user["_id"]}, {"$set": {"read": True}})
    return {"ok": True}

# ---------- Dashboards ----------
@api.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    role = user["role"]
    if role == "student":
        logs = [l async for l in db.logbooks.find({"student_id": user["_id"]})]
        approved = sum(1 for l in logs if l.get("status") == "approved")
        pending = sum(1 for l in logs if l.get("status") == "pending")
        rejected = sum(1 for l in logs if l.get("status") == "rejected")
        visits = await db.visits.count_documents({"student_id": user["_id"], "status": "verified"})
        return {"total_days": len(logs), "approved": approved,
                "pending": pending, "rejected": rejected, "visits": visits}
    if role == "supervisor":
        students = await db.allocations.count_documents({"supervisor_id": user["_id"]})
        upcoming = await db.visits.count_documents({"supervisor_id": user["_id"], "status": "scheduled"})
        verified = await db.visits.count_documents({"supervisor_id": user["_id"], "status": "verified"})
        # pending logbooks from own students
        student_ids = [a["student_id"] async for a in db.allocations.find({"supervisor_id": user["_id"]})]
        pending = await db.logbooks.count_documents({"student_id": {"$in": student_ids}, "status": "pending"}) if student_ids else 0
        return {"students": students, "upcoming_visits": upcoming,
                "verified_visits": verified, "pending_logbooks": pending}
    if role in ("coordinator", "admin"):
        students = await db.users.count_documents({"role": "student"})
        supervisors = await db.users.count_documents({"role": "supervisor"})
        pending_companies = await db.companies.count_documents({"status": "pending"})
        pending_logs = await db.logbooks.count_documents({"status": "pending"})
        total_visits = await db.visits.count_documents({})
        verified_visits = await db.visits.count_documents({"status": "verified"})
        allocations = await db.allocations.count_documents({})
        return {"students": students, "supervisors": supervisors,
                "pending_companies": pending_companies,
                "pending_logbooks": pending_logs,
                "total_visits": total_visits, "verified_visits": verified_visits,
                "allocations": allocations}
    return {}

@api.get("/dashboard/chart")
async def dashboard_chart(user: dict = Depends(get_current_user)):
    """Weekly logbook activity for the last 8 weeks."""
    q = {}
    if user["role"] == "student":
        q = {"student_id": user["_id"]}
    elif user["role"] == "supervisor":
        student_ids = [a["student_id"] async for a in db.allocations.find({"supervisor_id": user["_id"]})]
        q = {"student_id": {"$in": student_ids}} if student_ids else {"_id": None}
    logs = [l async for l in db.logbooks.find(q)]
    # bucket by ISO week
    from collections import Counter
    buckets = Counter()
    for l in logs:
        try:
            d = datetime.fromisoformat(l["date"])
            key = f"W{d.isocalendar()[1]}"
            buckets[key] += 1
        except Exception:
            pass
    keys = sorted(buckets.keys())[-8:]
    return [{"week": k, "entries": buckets[k]} for k in keys]

# ---------- Reports ----------
@api.get("/reports/summary")
async def report_summary(user: dict = Depends(require_roles("coordinator", "admin", "supervisor"))):
    students = [serialize_user(u) async for u in db.users.find({"role": "student"})]
    for s in students:
        s["logs_approved"] = await db.logbooks.count_documents(
            {"student_id": ObjectId(s["id"]), "status": "approved"})
        s["logs_total"] = await db.logbooks.count_documents(
            {"student_id": ObjectId(s["id"])})
        s["visits_verified"] = await db.visits.count_documents(
            {"student_id": ObjectId(s["id"]), "status": "verified"})
    return students


@api.get("/reports/summary.pdf")
async def report_summary_pdf(user: dict = Depends(require_roles("coordinator", "admin", "supervisor"))):
    """Generate a PDF summary of student SIWES progress."""
    import io
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    students = [serialize_user(u) async for u in db.users.find({"role": "student"})]
    data = [["Student", "Matric No.", "Logs total", "Approved", "Visits verified"]]
    for s in students:
        sid = ObjectId(s["id"])
        approved = await db.logbooks.count_documents({"student_id": sid, "status": "approved"})
        total = await db.logbooks.count_documents({"student_id": sid})
        verified = await db.visits.count_documents({"student_id": sid, "status": "verified"})
        data.append([s.get("name") or "", s.get("matric_no") or "—", str(total), str(approved), str(verified)])

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=18*mm, rightMargin=18*mm,
                            topMargin=18*mm, bottomMargin=18*mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Title"], fontSize=20, textColor=colors.HexColor("#0f172a"), spaceAfter=6)
    sub_style = ParagraphStyle("sub", parent=styles["Normal"], textColor=colors.HexColor("#64748b"), fontSize=10, spaceAfter=18)
    story = [
        Paragraph("SIWES Performance Report", title_style),
        Paragraph(f"Generated {now_utc().strftime('%d %b %Y, %H:%M UTC')} · Requested by {user['name']}", sub_style),
    ]
    tbl = Table(data, colWidths=[55*mm, 32*mm, 25*mm, 25*mm, 35*mm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f60ff")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor("#0f172a")),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 12))
    story.append(Paragraph(f"Total students: {len(students)}", styles["Normal"]))
    doc.build(story)
    buf.seek(0)
    filename = f"siwes-report-{now_utc().strftime('%Y%m%d-%H%M')}.pdf"
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{filename}"'})


# ---------- File Uploads (Object Storage) ----------
def _ext_of(filename: str, content_type: str) -> str:
    if "." in filename:
        return filename.rsplit(".", 1)[-1].lower()
    return (content_type or "").split("/")[-1] or "bin"

@api.post("/uploads/{scope}")
async def upload_file(scope: str, file: UploadFile = File(...),
                      user: dict = Depends(get_current_user)):
    """Upload an image. scope: 'logbook' | 'avatar'. Returns {id, url}."""
    if scope not in ("logbook", "avatar"):
        raise HTTPException(400, "Invalid upload scope")
    if not storage_service.is_available():
        raise HTTPException(503, "Object storage is not configured")
    ext = _ext_of(file.filename or "", file.content_type or "")
    if ext not in storage_service.MIME:
        raise HTTPException(400, f"Unsupported file type: {ext}")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(413, "File exceeds 5MB")
    path = storage_service.build_path(scope, str(user["_id"]), file.filename or f"upload.{ext}")
    result = storage_service.put_object(path, data, storage_service.MIME[ext])
    file_id = secrets.token_urlsafe(12)
    await db.files.insert_one({
        "file_id": file_id,
        "owner_id": user["_id"],
        "scope": scope,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": storage_service.MIME[ext],
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": iso(now_utc()),
    })
    # Return URL that the frontend will hit (with cookie auth via /api)
    return {"id": file_id, "url": f"/api/uploads/file/{file_id}",
            "content_type": storage_service.MIME[ext]}

@api.get("/uploads/file/{file_id}")
async def download_file(file_id: str, request: Request):
    """Serve an uploaded file. Uses cookie auth."""
    # Authenticate via cookie or Authorization header (image tags cannot send headers,
    # but our images are wrapped in fetch/blob or use cookie auth for same-origin).
    try:
        await get_current_user(request)
    except HTTPException:
        raise
    rec = await db.files.find_one({"file_id": file_id, "is_deleted": False})
    if not rec:
        raise HTTPException(404, "File not found")
    try:
        data, ct = storage_service.get_object(rec["storage_path"])
    except Exception as e:
        logger.error("download %s failed: %s", file_id, e)
        raise HTTPException(502, "Storage unavailable")
    return Response(content=data, media_type=rec.get("content_type", ct))


# ---------- Backup / Restore (admin) ----------
BACKUP_COLLECTIONS = [
    "users", "departments", "sessions", "companies", "logbooks",
    "visits", "gps_logs", "allocations", "notifications",
    "assessments", "audit_logs", "files",
]

def _mongo_to_json(doc: dict) -> dict:
    out = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            out[k] = {"$oid": str(v)}
        elif isinstance(v, dict):
            out[k] = _mongo_to_json(v)
        elif isinstance(v, list):
            out[k] = [_mongo_to_json(x) if isinstance(x, dict) else
                      ({"$oid": str(x)} if isinstance(x, ObjectId) else x) for x in v]
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out

def _json_to_mongo(doc: dict) -> dict:
    out = {}
    for k, v in doc.items():
        if isinstance(v, dict) and set(v.keys()) == {"$oid"}:
            out[k] = ObjectId(v["$oid"])
        elif isinstance(v, dict):
            out[k] = _json_to_mongo(v)
        elif isinstance(v, list):
            out[k] = [_json_to_mongo(x) if isinstance(x, dict) else x for x in v]
        else:
            out[k] = v
    return out

@api.get("/admin/backup")
async def db_backup(user: dict = Depends(require_roles("admin"))):
    """Download a JSON backup of all SIWES collections."""
    import io, json
    dump = {"created_at": iso(now_utc()), "collections": {}}
    for name in BACKUP_COLLECTIONS:
        col = db[name]
        dump["collections"][name] = [
            _mongo_to_json(d) async for d in col.find()
        ]
    await audit(user["_id"], "admin.backup",
                meta={"docs": sum(len(v) for v in dump["collections"].values())})
    buf = io.BytesIO(json.dumps(dump, indent=2).encode())
    filename = f"siwes-backup-{now_utc().strftime('%Y%m%d-%H%M%S')}.json"
    return StreamingResponse(buf, media_type="application/json",
                             headers={"Content-Disposition": f'attachment; filename="{filename}"'})

@api.post("/admin/restore")
async def db_restore(file: UploadFile = File(...),
                     user: dict = Depends(require_roles("admin"))):
    """Restore all collections from a backup JSON file. This REPLACES existing data."""
    import json
    raw = await file.read()
    try:
        data = json.loads(raw.decode())
        collections = data.get("collections", {})
    except Exception:
        raise HTTPException(400, "Invalid backup file")
    stats = {}
    for name in BACKUP_COLLECTIONS:
        if name not in collections:
            continue
        docs = collections[name] or []
        await db[name].delete_many({})
        if docs:
            await db[name].insert_many([_json_to_mongo(d) for d in docs])
        stats[name] = len(docs)
    await audit(user["_id"], "admin.restore", meta=stats)
    return {"restored": stats}


# ---------- Assessments ----------
@api.post("/assessments")
async def create_assessment(body: AssessmentIn,
                            user: dict = Depends(require_roles("supervisor"))):
    """Supervisor submits an end-of-SIWES assessment for a student."""
    # Ensure the student is actually allocated to this supervisor
    alloc = await db.allocations.find_one({
        "student_id": ObjectId(body.student_id), "supervisor_id": user["_id"]})
    if not alloc:
        raise HTTPException(403, "Student is not assigned to you")
    doc = {**body.model_dump(),
           "student_id": ObjectId(body.student_id),
           "supervisor_id": user["_id"],
           "created_at": iso(now_utc())}
    await db.assessments.update_one(
        {"student_id": ObjectId(body.student_id), "supervisor_id": user["_id"]},
        {"$set": doc}, upsert=True)
    await db.notifications.insert_one({
        "user_id": ObjectId(body.student_id),
        "title": "Assessment submitted",
        "body": f"{user['name']} submitted your SIWES assessment (rating {body.rating}/5).",
        "read": False, "created_at": iso(now_utc())})
    await audit(user["_id"], "assessment.submit", body.student_id, {"rating": body.rating})
    return {"ok": True}

@api.get("/assessments/student/{sid}")
async def get_assessment(sid: str, user: dict = Depends(get_current_user)):
    """Student sees their own; supervisor sees theirs; coordinator/admin see all."""
    q = {"student_id": ObjectId(sid)}
    if user["role"] == "student" and str(user["_id"]) != sid:
        raise HTTPException(403, "Not allowed")
    if user["role"] == "supervisor":
        q["supervisor_id"] = user["_id"]
    out = []
    async for a in db.assessments.find(q):
        out.append({
            "id": str(a["_id"]),
            "student_id": str(a["student_id"]),
            "supervisor_id": str(a["supervisor_id"]),
            "rating": a["rating"],
            "punctuality": a.get("punctuality"),
            "teamwork": a.get("teamwork"),
            "technical_skill": a.get("technical_skill"),
            "feedback": a.get("feedback"),
            "created_at": a["created_at"],
        })
    return out

# ---------- Audit logs (admin) ----------
@api.get("/audit-logs")
async def list_audit(limit: int = 100, user: dict = Depends(require_roles("admin"))):
    out = []
    async for a in db.audit_logs.find().sort("created_at", -1).limit(limit):
        actor = await db.users.find_one({"_id": a["actor_id"]}) if a.get("actor_id") else None
        out.append({
            "id": str(a["_id"]),
            "actor_email": actor.get("email") if actor else "system",
            "actor_role": actor.get("role") if actor else "system",
            "action": a["action"], "target": a.get("target", ""),
            "meta": a.get("meta", {}), "created_at": a["created_at"],
        })
    return out

# Health
@api.get("/")
async def root():
    return {"service": "SIWES API", "status": "ok"}

@api.get("/demo-users")
async def demo_users():
    """Public list of seeded demo accounts (labels + emails only, no passwords)."""
    return [
        {"role": "Admin", "email": "admin@siwes.edu"},
        {"role": "Coordinator", "email": "coordinator@siwes.edu"},
        {"role": "Supervisor", "email": "supervisor@siwes.edu"},
        {"role": "Student", "email": "student@siwes.edu"},
    ]

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://10.119.120.196:3000",
        "http://172.27.223.196:3000",
        "http://10.118.130.196:3000",
        "https://siwes-connect.netlify.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)