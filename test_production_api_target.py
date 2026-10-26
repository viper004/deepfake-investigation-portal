import os
import re
import sys

def test_config_target():
    print("[TEST 1] Verifying frontend/lib/config.ts target...")
    with open("frontend/lib/config.ts", "r") as f:
        content = f.read()
    assert "https://dip-backend-50047170003.development.catalystappsail.in" in content, "Missing production URL in config.ts"
    assert "127.0.0.1:8000" not in content, "Found 127.0.0.1:8000 in config.ts"
    print("  -> config.ts properly targets Catalyst AppSail backend.")

def test_no_localhost_in_frontend_source():
    print("[TEST 2] Verifying no hardcoded localhost:8000 / 127.0.0.1:8000 in frontend source files...")
    src_dirs = ["frontend/app", "frontend/components", "frontend/lib", "frontend/auth.ts"]
    for path in src_dirs:
        if os.path.isfile(path):
            files = [path]
        else:
            files = [os.path.join(dp, f) for dp, dn, filenames in os.walk(path) for f in filenames if f.endswith((".ts", ".tsx"))]
        for fpath in files:
            with open(fpath, "r", errors="ignore") as f:
                txt = f.read()
            if "127.0.0.1:8000" in txt or "localhost:8000" in txt:
                raise AssertionError(f"Hardcoded localhost found in {fpath}")
    print("  -> All frontend source files use configured BACKEND_URL.")

def test_no_localhost_in_next_build():
    print("[TEST 3] Verifying no localhost:8000 in compiled .next build output...")
    next_dir = "frontend/.next"
    if not os.path.exists(next_dir):
        print("  -> .next directory not found, skipping build output scan.")
        return
    matched_files = []
    for dp, dn, filenames in os.walk(next_dir):
        for f in filenames:
            if f.endswith((".js", ".html", ".json")):
                p = os.path.join(dp, f)
                with open(p, "r", errors="ignore") as file:
                    data = file.read()
                if "127.0.0.1:8000" in data or "localhost:8000" in data:
                    matched_files.append(p)
    assert len(matched_files) == 0, f"Found localhost in build artifacts: {matched_files}"
    print("  -> Zero occurrences of localhost:8000 / 127.0.0.1:8000 in .next build.")

def test_env_files():
    print("[TEST 4] Verifying frontend environment files (.env.production, .env.local)...")
    with open("frontend/.env.production", "r") as f:
        prod_env = f.read()
    assert "https://dip-backend-50047170003.development.catalystappsail.in" in prod_env, ".env.production missing prod URL"
    assert "127.0.0.1:8000" not in prod_env, ".env.production has 127.0.0.1:8000"

    with open("frontend/.env.local", "r") as f:
        local_env = f.read()
    assert "https://dip-backend-50047170003.development.catalystappsail.in" in local_env, ".env.local missing prod URL"
    assert "127.0.0.1:8000" not in local_env, ".env.local has 127.0.0.1:8000"
    print("  -> Both .env.production and .env.local point to production AppSail backend.")

if __name__ == "__main__":
    print("=== Production API Target Verification Suite ===")
    test_config_target()
    test_no_localhost_in_frontend_source()
    test_no_localhost_in_next_build()
    test_env_files()
    print("=== ALL 4 PRODUCTION CONFIG TESTS PASSED! ===")
