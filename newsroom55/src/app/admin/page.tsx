import { redirect } from "next/navigation";
import { readSession } from "@/lib/security/auth";
import { boot } from "@/lib/boot";
import { AdminConsole } from "@/components/admin/AdminConsole";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminPage() {
  await boot();
  const session = await readSession();
  if (!session) redirect("/admin/login");
  return <AdminConsole username={session.username} csrf={session.csrf} />;
}
