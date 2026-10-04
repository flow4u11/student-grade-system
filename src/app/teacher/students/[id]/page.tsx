import { notFound } from "next/navigation";
import { z } from "zod";
import { StudentProfile } from "@/components/student-profile";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  return <StudentProfile id={id} />;
}
