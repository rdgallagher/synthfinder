import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;

  // No password configured — allow through (local dev)
  if (!password) return NextResponse.next();

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const credentials = atob(auth.slice(6));
    const colonIndex = credentials.indexOf(":");
    const pass = credentials.slice(colonIndex + 1);
    if (pass === password) return NextResponse.next();
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="SynthFinder"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
