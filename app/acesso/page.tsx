import SupervisorLoginGate from "../components/SupervisorLoginGate";

export const dynamic = "force-dynamic";

export default async function AccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ message?: string }>;
}) {
  const params = (await searchParams) || {};
  return <SupervisorLoginGate message={params.message || ""} />;
}
