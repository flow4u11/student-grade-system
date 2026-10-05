import { HomeroomDashboard } from "@/components/homeroom-dashboard";
import { TeacherAccounts } from "@/components/teacher-accounts";
import {
  TeacherProfile,
  SchoolSettings,
  FeedbackPage,
} from "@/components/account-pages";
import { isAdmin } from "@/lib/permissions";
import { requireStaff } from "@/lib/supabase/server";
import { Assignments } from "@/components/assignments";
import { notFound } from "next/navigation";
import { Records } from "@/components/records";
import { Students } from "@/components/students";
import { ImportStudents } from "@/components/import-students";
import { Gradebook } from "@/components/gradebook";
import { TeacherGuide } from "@/components/teacher-guide";
import { Audit } from "@/components/audit";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (
    [
      "import",
      "terms",
      "classes",
      "subjects",
      "schemes",
      "assignments",
      "teachers",
      "audit",
    ].includes(section) &&
    !isAdmin((await requireStaff()).profile.role)
  )
    notFound();
  if (
    ![
      "students",
      "homeroom",
      "import",
      "terms",
      "classes",
      "subjects",
      "schemes",
      "gradebook",
      "audit",
      "guide",
      "assignments",
      "teachers",
      "settings",
      "profile",
      "feedback",
    ].includes(section)
  )
    notFound();
  return (
    <>
      {section === "homeroom" ? (
        <HomeroomDashboard />
      ) : section === "teachers" ? (
        <TeacherAccounts />
      ) : section === "profile" ? (
        <TeacherProfile />
      ) : section === "settings" ? (
        <SchoolSettings />
      ) : section === "feedback" ? (
        <FeedbackPage />
      ) : section === "assignments" ? (
        <Assignments />
      ) : section === "students" ? (
        <Students />
      ) : section === "import" ? (
        <ImportStudents />
      ) : section === "gradebook" ? (
        <Gradebook />
      ) : section === "guide" ? (
        <TeacherGuide />
      ) : section === "audit" ? (
        <Audit />
      ) : (
        <Records
          section={section as "terms" | "classes" | "subjects" | "schemes"}
        />
      )}
    </>
  );
}
