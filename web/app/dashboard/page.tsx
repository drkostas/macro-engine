import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const sql = getDb();
  const rows = await sql`SELECT id FROM nutrition_profile WHERE id = 1 LIMIT 1`;
  if (rows.length === 0) {
    redirect("/onboard");
  }
  return <DashboardClient />;
}
