# Auth Testing Playbook

## Test users seeded on startup
- admin@siwes.edu / Admin@1234 (role=admin)
- coordinator@siwes.edu / Password@123 (role=coordinator)
- supervisor@siwes.edu / Password@123 (role=supervisor)
- student@siwes.edu / Password@123 (role=student)

## Cookie based JWT
- Login sets `access_token` (15 min) + `refresh_token` (7 days) httpOnly cookies.
- Every axios request uses `withCredentials: true`.

## Curl smoke test
```
curl -c cookies.txt -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@siwes.edu","password":"Admin@1234"}'
curl -b cookies.txt $API_URL/api/auth/me
```
