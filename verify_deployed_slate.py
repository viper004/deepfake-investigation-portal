import urllib.request
import re
import json

SLATE_URL = "https://dip-frontend-npczgoxg.onslate.in"
LOGIN_PAGE = f"{SLATE_URL}/login"
BACKEND_URL = "https://dip-backend-50047170003.development.catalystappsail.in"

headers = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
}

print(f"1. Fetching live deployed Slate login page from: {LOGIN_PAGE}")
req = urllib.request.Request(LOGIN_PAGE, headers=headers)
with urllib.request.urlopen(req, timeout=15) as resp:
    html = resp.read().decode("utf-8")

print(f"  -> HTTP Status: {resp.status}, Content Length: {len(html)} bytes")

# Extract JS scripts from HTML
script_srcs = re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', html)
print(f"2. Found {len(script_srcs)} loaded scripts in deployed login page:")

found_backend_url = False
found_localhost = False

for s in script_srcs:
    script_url = s if s.startswith("http") else f"{SLATE_URL}{s}"
    try:
        s_req = urllib.request.Request(script_url, headers=headers)
        with urllib.request.urlopen(s_req, timeout=15) as s_resp:
            js_code = s_resp.read().decode("utf-8", errors="ignore")
        if "dip-backend-50047170003.development.catalystappsail.in" in js_code:
            print(f"  [✔ VERIFIED] {s}: Contains AppSail production URL!")
            found_backend_url = True
        if "127.0.0.1:8000" in js_code or "localhost:8000" in js_code:
            print(f"  [✖ WARNING] {s}: Contains localhost:8000!")
            found_localhost = True
    except Exception as e:
        print(f"  [!] Failed to fetch {script_url}: {e}")

print("\n--- Live Bundle Analysis Result ---")
if found_backend_url and not found_localhost:
    print("✔ SUCCESS: The deployed Next.js bundle at https://dip-frontend-npczgoxg.onslate.in")
    print("  is compiled with https://dip-backend-50047170003.development.catalystappsail.in")
    print("  and contains ZERO references to 127.0.0.1:8000!")
else:
    print(f"Found backend url: {found_backend_url}, Found localhost: {found_localhost}")

print("\n3. Testing browser-like login POST request from Slate origin to AppSail backend:")
post_headers = {
    "Origin": SLATE_URL,
    "Referer": f"{SLATE_URL}/login",
    "Content-Type": "application/json",
    "User-Agent": headers["User-Agent"]
}
login_payload = json.dumps({"email": "alexander.pierce@aurora.ai", "password": "password123"}).encode()
post_req = urllib.request.Request(f"{BACKEND_URL}/api/v1/auth/login", data=login_payload, headers=post_headers, method="POST")

with urllib.request.urlopen(post_req, timeout=15) as post_resp:
    res_body = post_resp.read().decode()
    res_headers = dict(post_resp.headers)

print(f"  -> HTTP Status: {post_resp.status}")
print(f"  -> Access-Control-Allow-Origin: {res_headers.get('access-control-allow-origin')}")
print(f"  -> Access-Control-Allow-Credentials: {res_headers.get('access-control-allow-credentials')}")
data = json.loads(res_body)
print(f"  -> Response message: {data.get('message')}")
print(f"  -> User email: {data.get('user', {}).get('email')}")
print(f"  -> Token received: {bool(data.get('access_token'))}")
