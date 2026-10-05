import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import "./demo/demo.css";
export const metadata: Metadata = {
  title: "School Ledger — จัดการเกรดอย่างเป็นระบบ",
  description:
    "ระบบจัดการผลการเรียนสำหรับครูและโรงเรียน ทดลองเดโมด้วยข้อมูลสมมติโดยไม่ต้องสมัครบัญชี",
  robots: { index: true, follow: true },
};
export default function Home() {
  return (
    <main className="public-site">
      <header className="landing-nav">
        <Link href="/" className="landing-brand">
          <span>
            <GraduationCap size={23} />
          </span>
          School Ledger <small>Beta</small>
        </Link>
        <nav aria-label="เมนูเว็บไซต์">
          <a href="#features">ความสามารถ</a>
          <a href="#about">เกี่ยวกับระบบ</a>
          <Link href="/login" prefetch={false}>
            เข้าสู่ระบบครู
          </Link>
        </nav>
      </header>
      <section className="landing-hero">
        <div className="landing-intro">
          <span className="landing-eyebrow">
            <Sparkles size={15} /> พื้นที่ทำงานสำหรับครู
          </span>
          <h1>
            จัดการผลการเรียน
            <br />
            <span>ให้เป็นเรื่องง่าย</span>
          </h1>
          <p>
            รวมรายชื่อนักเรียน ห้องเรียน รายวิชา และเกรดไว้ในที่เดียว
            ให้ครูใช้เวลากับการสอนได้มากขึ้น และติดตามผลการเรียนได้ชัดเจนขึ้น
          </p>
          <div className="landing-cta">
            <Link className="demo-button demo-primary" href="/demo">
              ทดลองใช้งานเดโม <ArrowRight size={18} />
            </Link>
            <Link className="demo-button" href="/login" prefetch={false}>
              เข้าสู่ระบบโรงเรียน
            </Link>
          </div>
          <small className="landing-note">
            <ShieldCheck size={15} /> เดโมใช้ข้อมูลสมมติทั้งหมด ·
            ไม่ต้องสมัครหรือใส่รหัสผ่าน
          </small>
        </div>
        <div className="landing-preview" aria-label="ตัวอย่างภาพรวมข้อมูลสมมติ">
          <div className="landing-preview-top">
            <span className="preview-dot" />
            <span className="preview-dot" />
            <span className="preview-dot" />
            <small>School Ledger / ภาพรวม</small>
          </div>
          <div className="landing-preview-body">
            <span className="demo-overline">ภาคเรียนที่ 1 · ข้อมูลสมมติ</span>
            <h2>พร้อมสำหรับวันสอนใหม่</h2>
            <div className="landing-preview-stats">
              <div>
                <Users size={20} />
                <strong>6</strong>
                <small>นักเรียนตัวอย่าง</small>
              </div>
              <div>
                <BookOpen size={20} />
                <strong>4</strong>
                <small>รายวิชา</small>
              </div>
            </div>
            <div className="preview-course">
              <span>คณิตศาสตร์</span>
              <strong>
                ครบแล้ว <Check size={15} />
              </strong>
            </div>
            <div className="demo-progress">
              <span style={{ width: "100%" }} />
            </div>
            <div className="preview-course">
              <span>ภาษาไทย</span>
              <strong>พร้อมตรวจสอบ</strong>
            </div>
            <div className="demo-progress">
              <span style={{ width: "76%" }} />
            </div>
            <Link href="/demo" className="landing-preview-link">
              เปิดเดโมแบบโต้ตอบ <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
      <section id="features" className="landing-section">
        <span className="demo-overline">ออกแบบรอบการทำงานของครู</span>
        <h2>จากรายชื่อนักเรียน ถึงผลการเรียน</h2>
        <div className="landing-feature-grid">
          {[
            {
              Icon: Users,
              title: "นักเรียนและห้องเรียน",
              text: "ค้นหาและติดตามนักเรียน ดูข้อมูลรายคนพร้อม GPA และมอบหมายครูประจำชั้น",
            },
            {
              Icon: BookOpen,
              title: "กรอกเกรดได้สองวิธี",
              text: "ทำงานตามรายวิชาหรือตามนักเรียน บันทึกฉบับร่างก่อนตรวจสอบและประกาศผล",
            },
            {
              Icon: ShieldCheck,
              title: "แยกสิทธิ์การทำงาน",
              text: "ผู้ดูแลจัดการข้อมูลหลัก ครูเข้าถึงตามสิทธิ์ที่ได้รับ และติดตามผู้ดำเนินการจากประวัติ",
            },
          ].map(({ Icon, title, text }) => (
            <article key={title}>
              <span className="feature-icon">
                <Icon size={22} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section id="about" className="landing-about">
        <div>
          <span className="demo-overline">เกี่ยวกับ School Ledger</span>
          <h2>พัฒนาเพื่อครูและโรงเรียน</h2>
          <p>
            School Ledger เป็นโครงการโอเพนซอร์สสำหรับจัดการผลการเรียน
            ปัจจุบันอยู่ในช่วงเบต้า
            ระบบจริงต้องเข้าสู่ระบบและได้รับสิทธิ์จากผู้ดูแล
            ส่วนเดโมเปิดให้ทุกคนสำรวจหน้าตาและลองการทำงานด้วยข้อมูลสมมติ
          </p>
          <p>
            ขณะนี้ยังไม่มีบริการชำระเงิน การสมัครสมาชิกแบบเสียเงิน
            หรือระบบรับชำระผ่าน Stripe
          </p>
        </div>
        <div className="landing-contact">
          <h3>คำถามและข้อเสนอแนะ</h3>
          <p>
            อ่านคู่มือ ดูซอร์สโค้ด และแจ้งปัญหาผ่าน GitHub ของโครงการ
            กรุณาไม่แนบข้อมูลนักเรียน รหัสผ่าน หรือข้อมูลส่วนตัวในพื้นที่สาธารณะ
          </p>
          <a
            className="demo-button"
            href="https://github.com/flow4u11/student-grade-system"
            target="_blank"
            rel="noopener noreferrer"
          >
            คู่มือและ GitHub <ArrowRight size={16} />
          </a>
        </div>
      </section>
      <footer className="landing-footer">
        <span>School Ledger · Student Grade Management</span>
        <div>
          <Link href="/demo">ทดลองเดโม</Link>
          <Link href="/login" prefetch={false}>
            สำหรับครูและผู้ดูแล
          </Link>
          <a
            href="https://github.com/flow4u11/student-grade-system/blob/main/docs/SECURITY.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            ความปลอดภัย
          </a>
        </div>
      </footer>
    </main>
  );
}
