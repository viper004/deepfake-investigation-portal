import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = "https://dip-backend-50047170003.development.catalystappsail.in";

export async function handleProxy(
  request: NextRequest,
  basePrefix: string,
  slugPromise: Promise<{ slug?: string[] }>
) {
  const { slug } = await slugPromise;
  const pathPart = slug && slug.length > 0 ? slug.join("/") : "";
  const targetUrl = `${BACKEND_BASE}${basePrefix}${pathPart ? "/" + pathPart : ""}${request.nextUrl.search}`;

  const forwardHeaders = new Headers();
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey !== "host" && lowerKey !== "content-length") {
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

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body,
      redirect: "follow",
    });

    const responseHeaders = new Headers();
    upstreamResponse.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey !== "content-encoding" &&
        lowerKey !== "transfer-encoding" &&
        lowerKey !== "connection"
      ) {
        responseHeaders.set(key, value);
      }
    });

    responseHeaders.set("Access-Control-Allow-Origin", request.headers.get("origin") || "*");
    responseHeaders.set("Access-Control-Allow-Credentials", "true");

    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return NextResponse.json(
      { detail: `Upstream gateway error: ${err.message}` },
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
