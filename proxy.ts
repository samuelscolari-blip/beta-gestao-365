import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    return NextResponse.next();
  }

  const securedUrl = request.nextUrl.clone();
  securedUrl.pathname = "/api/records-v52";
  return NextResponse.rewrite(securedUrl);
}

export const config = {
  matcher: "/api/records",
};
