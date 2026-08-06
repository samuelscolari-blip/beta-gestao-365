import AccessGate from "../components/AccessGate";

export const dynamic = "force-dynamic";

export default async function AccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; message?: string }>;
}) {
  const params = (await searchParams) || {};
  return (
    <AccessGate
      nextPath={params.next || "/"}
      message={params.message || ""}
    />
  );
}
