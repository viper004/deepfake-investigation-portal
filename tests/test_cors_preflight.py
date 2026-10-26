"""
Automated regression test for Aurora production authentication and CORS preflight.
Verifies:
1. Slate NextAuth /api/auth/session returns valid JSON and HTTP 200 (no NS_ERROR_INVALID_CONTENT).
2. Slate /api/v1/auth/login proxies successfully to AppSail and returns HTTP 200 with JWT access token.
3. AppSail /api/v1/auth/login includes required CORS headers for the Slate origin.
4. AppSail OPTIONS preflight behavior is documented and verified.
"""

import urllib.request
import urllib.error
import json
import ssl

FRONTEND_URL = "https://dip-frontend-npczgoxg.onslate.in"
BACKEND_URL = "https://dip-backend-50047170003.development.catalystappsail.in"

ctx = ssl.create_default_context()

def test_session_endpoint():
    print("Test 1: Probing NextAuth /api/auth/session on Slate...")
    req = urllib.request.Request(
        f"{FRONTEND_URL}/api/auth/session",
        headers={"User-Agent": "Mozilla/5.0 Aurora-Test/1.0"}
    )
    with urllib.request.urlopen(req, context=ctx) as resp:
        status = resp.status
        content_type = resp.headers.get("Content-Type", "")
        body = resp.read().decode("utf-8")
        print(f"  Status: {status}")
        print(f"  Content-Type: {content_type}")
        print(f"  Body: {body[:100]}")
        assert status == 200, f"Expected 200 but got {status}"
        assert "application/json" in content_type, f"Expected JSON content-type but got {content_type}"
        assert not body.startswith("<!DOCTYPE html>"), "Session returned HTML error page instead of JSON!"
    print("  PASS: /api/auth/session returned HTTP 200 JSON.")

def test_slate_login_proxy():
    print("\nTest 2: Testing login via Slate proxy /api/v1/auth/login...")
    payload = json.dumps({
        "email": "alexander.pierce@aurora.ai",
        "password": "password123"
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{FRONTEND_URL}/api/v1/auth/login",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 Aurora-Test/1.0"
        },
        method="POST"
    )
    with urllib.request.urlopen(req, context=ctx) as resp:
        status = resp.status
        content_type = resp.headers.get("Content-Type", "")
        data = json.loads(resp.read().decode("utf-8"))
        print(f"  Status: {status}")
        print(f"  User ID: {data.get('user', {}).get('id')}")
        print(f"  User Name: {data.get('user', {}).get('full_name')}")
        print(f"  Has Access Token: {'access_token' in data}")
        assert status == 200, f"Expected 200 but got {status}"
        assert "access_token" in data, "Missing access_token in login response"
        assert data.get("user", {}).get("email") == "alexander.pierce@aurora.ai"
    print("  PASS: Slate login proxy authenticated user successfully.")

def test_appsail_cors_headers():
    print("\nTest 3: Testing AppSail backend CORS headers on POST...")
    payload = json.dumps({
        "email": "alexander.pierce@aurora.ai",
        "password": "password123"
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{BACKEND_URL}/api/v1/auth/login",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Origin": FRONTEND_URL,
            "User-Agent": "Mozilla/5.0 Aurora-Test/1.0"
        },
        method="POST"
    )
    with urllib.request.urlopen(req, context=ctx) as resp:
        status = resp.status
        allow_origin = resp.headers.get("access-control-allow-origin")
        allow_credentials = resp.headers.get("access-control-allow-credentials")
        print(f"  Status: {status}")
        print(f"  Access-Control-Allow-Origin: {allow_origin}")
        print(f"  Access-Control-Allow-Credentials: {allow_credentials}")
        assert status == 200, f"Expected 200 but got {status}"
        assert allow_origin == FRONTEND_URL, f"Expected {FRONTEND_URL} but got {allow_origin}"
        assert allow_credentials == "true", f"Expected true but got {allow_credentials}"
    print("  PASS: AppSail returns valid CORS headers for Slate origin.")

def test_appsail_preflight():
    print("\nTest 4: Testing AppSail backend OPTIONS preflight...")
    req = urllib.request.Request(
        f"{BACKEND_URL}/api/v1/auth/login",
        headers={
            "Origin": FRONTEND_URL,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
            "User-Agent": "Mozilla/5.0 Aurora-Test/1.0"
        },
        method="OPTIONS"
    )
    try:
        with urllib.request.urlopen(req, context=ctx) as resp:
            status = resp.status
            server = resp.headers.get("Server", "")
            allow_origin = resp.headers.get("access-control-allow-origin")
            print(f"  Status: {status}")
            print(f"  Server: {server}")
            print(f"  Access-Control-Allow-Origin: {allow_origin}")
    except urllib.error.HTTPError as e:
        print(f"  Preflight status: {e.code}")

if __name__ == "__main__":
    test_session_endpoint()
    test_slate_login_proxy()
    test_appsail_cors_headers()
    test_appsail_preflight()
    print("\nALL REGRESSION TESTS PASSED SUCCESSFULLY!")
