import type { Metadata } from "next";
import { DemoWorkspace } from "@/components/demo-workspace";
import "./demo.css";
export const metadata: Metadata = {
  title: "ทดลองใช้งาน — School Ledger Demo",
  description:
    "สำรวจระบบจัดการผลการเรียนด้วยข้อมูลสมมติ ไม่ต้องเข้าสู่ระบบ และไม่เชื่อมต่อข้อมูลโรงเรียนจริง",
  robots: { index: true, follow: true },
};
export default function DemoPage() {
  return <DemoWorkspace />;
}
