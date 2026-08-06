import {
  authenticatedEmail,
  SOLE_ADMIN_EMAIL,
} from "../../lib/server-access";
import { staffSessionFromHeaders } from "../../lib/staff-access";

export async function GET(request: Request) {
  const email = authenticatedEmail(request);
  if (email === SOLE_ADMIN_EMAIL) {
    return Response.json(
      {
        authenticated: true,
        role: "administrador",
        name: "Samuel Scolari",
        email,
      },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const staff = await staffSessionFromHeaders(request.headers);
  if (!staff) {
    return Response.json(
      { authenticated: false },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  return Response.json(
    {
      authenticated: true,
      role: staff.role,
      name: staff.name,
      registration: staff.registration,
      expiresAt: staff.expiresAt,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
