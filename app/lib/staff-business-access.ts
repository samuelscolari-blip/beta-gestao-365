import {
  clearStaffSessionCookie,
  createStaffSession,
  deleteStaffSession,
  hasStaffSessionCookie,
  listActiveStaffAccounts,
  staffAccountByRegistration,
  staffSessionCookie,
  staffSessionFromHeaders,
  verifyStaffCredentials,
  type StaffAccount,
  type StaffRole,
  type StaffSession,
} from "./staff-access";

const LEGACY_TO_BUSINESS: Record<string, string> = {
  "ENC-001": "34135",
  "ENC-002": "25804",
  "ENC-003": "74509",
};

const BUSINESS_TO_LEGACY = Object.fromEntries(
  Object.entries(LEGACY_TO_BUSINESS).map(([legacy, business]) => [business, legacy]),
) as Record<string, string>;

function fiveDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 5);
}

function businessRegistration(value: string) {
  return LEGACY_TO_BUSINESS[value] || fiveDigits(value);
}

function internalRegistration(value: unknown) {
  const registration = fiveDigits(value);
  return BUSINESS_TO_LEGACY[registration] || registration;
}

function publicAccount(account: StaffAccount): StaffAccount {
  return {
    ...account,
    registration: businessRegistration(account.registration),
  };
}

export type BusinessStaffAccount = StaffAccount;
export type BusinessStaffSession = StaffSession;
export type BusinessStaffRole = StaffRole;

export { clearStaffSessionCookie, deleteStaffSession, hasStaffSessionCookie, staffSessionCookie };

export async function verifyBusinessStaffCredentials(
  registrationInput: unknown,
  passwordInput: unknown,
) {
  const registration = fiveDigits(registrationInput);
  if (registration.length !== 5) {
    return {
      ok: false as const,
      error: "Informe a matrícula com os cinco primeiros dígitos do CPF.",
    };
  }

  const verified = await verifyStaffCredentials(
    internalRegistration(registration),
    passwordInput,
  );
  if (!verified.ok) return verified;

  return {
    ok: true as const,
    internalAccount: verified.account,
    account: publicAccount(verified.account),
  };
}

export async function createBusinessStaffSession(account: StaffAccount) {
  return createStaffSession(account);
}

export async function businessStaffSessionFromHeaders(headers: {
  get(name: string): string | null;
}): Promise<BusinessStaffSession | null> {
  const session = await staffSessionFromHeaders(headers);
  if (!session) return null;
  return {
    ...session,
    registration: businessRegistration(session.registration),
  };
}

export async function listBusinessStaffAccounts(): Promise<BusinessStaffAccount[]> {
  const accounts = await listActiveStaffAccounts();
  return accounts.map(publicAccount);
}

export async function businessStaffAccountByRegistration(
  registrationInput: unknown,
): Promise<BusinessStaffAccount | null> {
  const registration = fiveDigits(registrationInput);
  if (registration.length !== 5) return null;
  const account = await staffAccountByRegistration(
    internalRegistration(registration),
  );
  return account ? publicAccount(account) : null;
}
