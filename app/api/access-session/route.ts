import {
  authenticatedEmail,
  SOLE_ADMIN_EMAIL,
} from "../../lib/server-access";
import { masterPointSessionFromHeaders } from "../../lib/master-point-access";
import { businessStaffSessionFromHeaders } from "../../lib/staff-business-access";

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

  const master = await masterPointSessionFromHeaders(request.headers);
  if (master) {
    return Response.json(
      {
        authenticated: true,
        role: master.actorRole,
        name: master.actorName,
        registration: master.actorRegistration,
        selectedEmployeeRegistration: master.selectedEmployeeRegistration,
        selectedEmployeeName: master.selectedEmployeeName,
        expiresAt: master.expiresAt,
      },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const staff = await businessStaffSessionFromHeaders(request.headers);
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
