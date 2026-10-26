import { NextRequest } from "next/server";
import { handleProxy, handleOptions } from "@/lib/proxy";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug?: string[] }> }) {
  return handleProxy(req, "/api/v1", params);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug?: string[] }> }) {
  return handleProxy(req, "/api/v1", params);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug?: string[] }> }) {
  return handleProxy(req, "/api/v1", params);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug?: string[] }> }) {
  return handleProxy(req, "/api/v1", params);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug?: string[] }> }) {
  return handleProxy(req, "/api/v1", params);
}

export async function OPTIONS() {
  return handleOptions();
}
