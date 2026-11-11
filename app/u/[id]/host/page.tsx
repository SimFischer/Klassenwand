import { ActivityView } from "@/components/activity-view";
import { findActivity } from "@/lib/db/repository";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    await findActivity(id, "u");
  } catch (e) {
    if ((e as { status?: number }).status === 404) notFound();
    throw e;
  }
  return <ActivityView id={id} kind="u" hostMode />;
}
