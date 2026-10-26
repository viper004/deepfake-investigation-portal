import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LIB_PY311 = os.path.join(BASE_DIR, "lib_py311")
if sys.version_info < (3, 14) and os.path.isdir(LIB_PY311) and LIB_PY311 not in sys.path:
    sys.path.insert(0, LIB_PY311)

if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.main import app as fastapi_app

class CorsHeaderMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            method = scope.get("method", "")
            headers = dict(scope.get("headers", []))
            origin = headers.get(b"origin", b"").decode("utf-8")
            
            allowed_origins = [
                "https://aurora.onslate.in",
                "https://dip-frontend-npczgoxg.onslate.in",
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            ]
            matched_origin = origin if (origin in allowed_origins or origin.endswith(".onslate.in")) else (allowed_origins[0] if origin else "*")

            if method == "OPTIONS":
                response_headers = [
                    (b"access-control-allow-origin", matched_origin.encode("utf-8")),
                    (b"access-control-allow-credentials", b"true"),
                    (b"access-control-allow-methods", b"GET, POST, PUT, DELETE, OPTIONS, PATCH"),
                    (b"access-control-allow-headers", b"Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers"),
                    (b"access-control-max-age", b"86400"),
                    (b"content-length", b"0"),
                ]
                await send({
                    "type": "http.response.start",
                    "status": 204,
                    "headers": response_headers,
                })
                await send({
                    "type": "http.response.body",
                    "body": b"",
                })
                return

        await self.app(scope, receive, send)

app = CorsHeaderMiddleware(fastapi_app)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("X_ZOHO_CATALYST_LISTEN_PORT", os.environ.get("PORT", 8000)))
    uvicorn.run(app, host="0.0.0.0", port=port)
