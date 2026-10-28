import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE =
  process.env.BACKEND_INTERNAL_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://127.0.0.1:8000"
    : "https://dip-backend-50047170003.development.catalystappsail.in");

export async function handleProxy(
  request: NextRequest,
  basePrefix: string,
  slugPromise: Promise<{ slug?: string[] }>
) {
  try {
    const resolvedParams = await Promise.resolve(slugPromise);
    const slug = resolvedParams?.slug;
    const pathPart = slug && slug.length > 0 ? slug.join("/") : "";
    const search = request.nextUrl?.search || "";
    const targetUrl = `${BACKEND_BASE}${basePrefix}${pathPart ? "/" + pathPart : ""}${search}`;

    const forwardHeaders = new Headers();
    request.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!["host", "content-length", "connection", "accept-encoding"].includes(lowerKey)) {
        forwardHeaders.set(key, value);
      }
    });

    const method = request.method;
    let body: ArrayBuffer | undefined = undefined;
    if (!["GET", "HEAD"].includes(method)) {
      try {
        body = await request.arrayBuffer();
      } catch {
        body = undefined;
      }
    }

    const upstreamResponse = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body,
      redirect: "follow",
    });

    const dataBuffer = await upstreamResponse.arrayBuffer();

    const responseHeaders = new Headers();
    upstreamResponse.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!["content-encoding", "transfer-encoding", "connection"].includes(lowerKey)) {
        responseHeaders.set(key, value);
      }
    });

    responseHeaders.set("Access-Control-Allow-Origin", request.headers.get("origin") || "*");
    responseHeaders.set("Access-Control-Allow-Credentials", "true");

    return new NextResponse(dataBuffer, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return NextResponse.json(
      { detail: `Upstream gateway error: ${err?.message || "Unknown error"}` },
      { status: 502 }
    );
  }
}

export function handleOptions() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}
