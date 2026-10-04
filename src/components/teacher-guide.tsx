"use client";
import Link from "next/link";
import { BookOpen, ArrowUpRight } from "lucide-react";
import { useSchool } from "./data";
import { useLocale } from "./providers";
import { isAdmin } from "@/lib/permissions";
type Step = [string, string, string];
export function TeacherGuide() {
  const { t, locale } = useLocale();
  const { meta } = useSchool();
  const th = locale === "th",
    admin = isAdmin(meta.profile.role);
  const teacherSteps: Step[] = th
    ? [
        [
          "1. เริ่มงานและเลือกภาคเรียน",
          "เลือกภาคเรียนมุมขวาบนก่อนทำงาน หน้าหลักแสดงวิชาและห้องที่ได้รับมอบหมาย กดรายการเพื่อเข้าสมุดคะแนน หากไม่มีรายการ ให้ผู้ดูแลมอบหมายวิชาหรือแต่งตั้งเป็นครูประจำชั้น ครูประจำชั้นเห็นทุกวิชาของห้องที่ดูแลในเทอมนั้น",
          "",
        ],
        [
          "2. ตรวจและแก้ไขข้อมูลนักเรียน",
          "เมนูนักเรียนเรียงตามห้องเป็นหลัก ค้นหาชื่อหรือรหัส เลือกห้องเพื่อกรอง กดชื่อเพื่อเปิดโปรไฟล์ หรือกดแก้ไขเพื่อเปลี่ยนชื่อ นามสกุล รหัส เลขที่ และห้องในเทอมที่มีสิทธิ์ รักษาเลขศูนย์หน้ารหัสไว้ การแก้ชื่อและรหัสมีผลกับตัวนักเรียนทุกเทอม ส่วนห้องและเลขที่มีผลกับเทอมที่เลือก",
          "students",
        ],
        [
          "3. กรอกตามนักเรียน: ทุกวิชาในหน้าเดียว",
          "กดชื่อนักเรียนจากรายชื่อแล้วกรอกคะแนนในแต่ละวิชา ระบบแสดงเกรดตัวอย่างทันที กดบันทึกก่อนเปลี่ยนหน้า ใช้ปุ่มนักเรียนคนถัดไป/คนก่อนหน้าเพื่อเดินตามเลขที่ในห้อง ครูรายวิชาเห็นเฉพาะวิชาที่ได้รับมอบหมาย ส่วนครูประจำชั้นเห็นทั้งหมดของห้อง วางเมาส์หรือกดที่ GPA เพื่ออ่านรายละเอียด",
          "students",
        ],
        [
          "4. กรอกตามรายวิชา: นักเรียนทั้งห้อง",
          "เปิดสมุดคะแนน กดเลือกวิชา ค้นหาชื่อ รหัส หรือห้องเรียน แต่ละรายการแสดงจำนวนที่กรอกและประกาศแล้ว กดรายการที่ต้องการเพื่อเปิดคะแนนทั้งห้อง กรอกคะแนนเต็มตามที่ระบุ กด Enter เพื่อไปช่องถัดไป หรือใช้ Tab กรอกต่อ วิชาแบบผ่าน/ไม่ผ่านอาจคำนวณจากคะแนนหรือให้เลือกผล ตามการตั้งค่าวิชา ช่องว่างหมายถึงยังไม่บันทึก ไม่ใช่คะแนนศูนย์ กดบันทึกคะแนนเมื่อเสร็จ",
          "gradebook",
        ],
        [
          "5. บันทึก ประกาศ และแก้เกรด",
          "บันทึกจะเก็บเป็นฉบับร่าง ตรวจคะแนนก่อนกดประกาศ คะแนนที่ประกาศแล้วล็อกการแก้ไข หากต้องการแก้ ให้ยกเลิกการประกาศก่อน แก้และบันทึก แล้วประกาศใหม่ เมื่อระบบแจ้งว่าข้อมูลเปลี่ยนโดยผู้ใช้อื่น ให้โหลดข้อมูลใหม่ก่อนกรอกต่อ เพื่อไม่ทับงานของกันและกัน",
          "gradebook",
        ],
        [
          "6. ล้างเกรดและย้ายห้อง",
          "ปุ่มล้างเกรดในโปรไฟล์ลบเฉพาะวิชาของนักเรียนคนนี้ ในสมุดคะแนนลบวิชาที่เลือกทั้งห้อง รวมผลที่ประกาศแล้ว เมื่อยืนยัน ผลจะเป็นยังไม่บันทึก ต้องกรอกและประกาศใหม่ กู้คืนไม่ได้ หากย้ายห้องที่มีเกรด ต้องให้ครูประจำชั้นหรือผู้ดูแลเลือกยืนยันล้างเกรดเทอมนี้ก่อนย้าย และต้องมีสิทธิ์ในห้องปลายทาง เกรดเทอมอื่นไม่ถูกล้าง",
          "students",
        ],
        [
          "7. รูปโปรไฟล์ บัญชี และการช่วยเหลือ",
          "กดรูปหรือชื่อของคุณที่ด้านล่างเมนูเพื่อเปิดโปรไฟล์ แก้ชื่อเล่น ข้อมูลติดต่อ และข้อมูลการสอน กดบนรูปโปรไฟล์เพื่ออัปโหลด JPG/PNG/WebP ไม่เกิน 2 MB รูปจะบันทึกทันที ส่วนข้อมูลอื่นกดบันทึก หากชื่อทางการไม่ถูกต้องให้ติดต่อผู้ดูแล ส่งปัญหาผ่านข้อเสนอแนะ เปลี่ยนภาษาที่แถบด้านบน ส่วนโหมดสว่าง/มืด/ตามระบบอยู่ในเมนูการตั้งค่า",
          "profile",
        ],
      ]
    : [
        [
          "1. Start with the correct term",
          "Choose a term at the top right. Dashboard courses follow your assignments. Ask an administrator for course or homeroom access if the list is empty. Homeroom access includes every subject in that classroom for that term.",
          "",
        ],
        [
          "2. Edit students",
          "Search or filter Students by class; click a name to open the profile or Edit to change name, ID, roll number and an authorized classroom. Preserve leading zeroes. Identity changes apply across terms; classroom and roll number belong to the selected term.",
          "students",
        ],
        [
          "3. Grade by student",
          "Open a student and enter all authorized subjects on one screen. Save before leaving. Previous/Next follows the classroom roll order. Hover or focus GPA for details. Course teachers see assigned subjects; homeroom teachers see all classroom subjects.",
          "students",
        ],
        [
          "4. Grade by subject",
          "In Gradebook, open Choose course and search by name, code or classroom. Cards show recorded and published counts. Click a course to open its classroom roster. Enter moves to the next row; Tab also works. Pass/fail is automatic or manually selected as configured. A blank result is not a zero. Save changes when finished.",
          "gradebook",
        ],
        [
          "5. Save, publish and correct",
          "Save creates drafts. Review before publishing. Unpublish to edit locked results, then save and publish again. If another user changed data, reload before continuing.",
          "gradebook",
        ],
        [
          "6. Reset results and move students",
          "Reset in a student profile clears one subject for that student; Reset in Gradebook clears the selected course for the whole class, including published results. This cannot be undone. Enter and publish again. Moving a graded student requires homeroom/admin confirmation to clear this term and access to the destination; other terms remain.",
          "students",
        ],
        [
          "7. Your account and help",
          "Click your photo/name at the bottom of navigation. Click the profile photo to upload JPG/PNG/WebP up to 2 MB; the photo saves immediately. Save other profile changes separately. Ask the administrator to correct official names. Send issues through Feedback. Change language in the top bar. Light, dark and system display modes are in Settings.",
          "profile",
        ],
      ];
  const adminSteps: Step[] = th
    ? [
        [
          "1. เตรียมภาคเรียน ห้อง และนักเรียน",
          "เพิ่มเทอมและห้องก่อน เลือกเทอมมุมขวาบน แล้วเพิ่มนักเรียนหรือนำเข้า Excel ตรวจตัวอย่างก่อนยืนยัน รหัสต้องไม่ซ้ำ ชื่อและรหัสเป็นข้อมูลกลาง ห้องและเลขที่แยกตามเทอม ผู้ดูแลจัดการนักเรียนทั้งโรงเรียนได้",
          "students",
        ],
        [
          "2. เพิ่มวิชาและเปิดหลายห้องในครั้งเดียว",
          "เปิดรายวิชา → วิชาที่เปิดสอน → เพิ่ม เลือกวิชาเดิม หรือเลือก + เพิ่มวิชาใหม่ในหน้านี้ แล้วกรอกรหัสและชื่อ เลือกเทอม ติ๊กห้องที่ต้องการ ระบุหน่วยกิตและเกณฑ์คะแนน แล้วบันทึกครั้งเดียว ทะเบียนรายวิชาใช้แก้ชื่อหรือหน่วยกิตตั้งต้น การแก้หน่วยกิตตั้งต้นไม่เปลี่ยนวิชาที่เปิดสอนไว้แล้ว",
          "subjects",
        ],
        [
          "3. เชิญและมอบหมายครู",
          "กดเชิญครูด้านบน สร้างรหัสและคัดลอกลิงก์ ครูกรอกชื่อไทยและอังกฤษ ใช้รหัสเชิญ และตั้งรหัสผ่าน ระบบสร้างชื่อบัญชีให้ ครูใหม่ยังไม่เห็นนักเรียนจนได้รับสิทธิ์ ที่เมนูมอบหมายวิชา เลือกครูและติ๊กวิชา หรือติ๊กห้องในส่วนครูประจำชั้นเพื่อให้เห็นทุกวิชาในเทอมที่เลือก ยกเลิกเครื่องหมายเพื่อถอนสิทธิ์ทันที",
          "assignments",
        ],
        [
          "4. ลบถาวรหรือจัดเก็บ เลือกให้ตรงงาน",
          "ลบถาวรจะลบจริงหลังยืนยันและกู้คืนไม่ได้: นักเรียนลบพร้อมห้องและเกรดของคนนั้น; วิชาหรือวิชาที่เปิดสอนลบพร้อมเกรดที่เกี่ยวข้อง; ห้องหรือเทอมลบรายชื่อการเข้าเรียนและวิชาที่เปิดสอนที่เกี่ยวข้อง แต่ตัวนักเรียนยังอยู่; เกณฑ์คะแนนลบวิชาที่ใช้เกณฑ์นั้นพร้อมเกรด ปุ่มจัดเก็บเก็บประวัติและมีปุ่มนำกลับมาใช้งานแยกต่างหาก ตรวจขอบเขตในหน้าต่างยืนยันทุกครั้ง",
          "subjects",
        ],
        [
          "5. จัดการบัญชีครู",
          "เมนูบัญชีครูค้นหาได้จากชื่อไทย ชื่ออังกฤษ หรือบัญชีเข้าสู่ระบบ กดแก้ไขเพื่อเพิ่มชื่อไทยของบัญชีเก่าและปรับข้อมูลติดต่อ ชื่อบัญชีและรหัสผ่านเดิมยังใช้ได้ หากข้อมูลถูกแก้พร้อมกันให้เปิดรายการใหม่ก่อนบันทึก กดลบบัญชีถาวรสำหรับบัญชีครูที่ไม่ใช้ จะลบบัญชีเข้าสู่ระบบ โปรไฟล์ รูป ข้อเสนอแนะ และการมอบหมายงาน ไม่มีสำเนาบัญชีสำหรับกู้คืน ผลการเรียนยังเป็นข้อมูลของโรงเรียนและคงอยู่ ไม่อนุญาตให้ลบบัญชีผู้ดูแล/Developer หรือตัวคุณเองผ่านหน้านี้",
          "teachers",
        ],
        [
          "6. ตั้งค่าโรงเรียนและตรวจการใช้งาน",
          "ตั้งค่าโรงเรียนใช้เปลี่ยนชื่อ สี และโดเมนบัญชีครู สีมีผลทั่วเว็บ ตั้งค่าเกณฑ์คะแนนก่อนเปิดวิชาใหม่ ตรวจรายการเปลี่ยนแปลงได้ที่ประวัติการใช้งาน รูปและข้อมูลส่วนตัวอยู่ที่โปรไฟล์ด้านล่างเมนู คู่มือส่วนถัดไปอธิบายการกรอกเกรดที่ผู้ดูแลใช้ได้เช่นเดียวกับครู",
          "settings",
        ],
      ]
    : [
        [
          "1. Prepare terms, classrooms and students",
          "Create terms and classes, choose the term, then add/import students. Preview imports and preserve unique IDs. Identity is shared across terms; class and roll number belong to each term.",
          "students",
        ],
        [
          "2. Create subjects and offerings together",
          "Subjects → Offerings → Add: select an existing subject or Create a new subject here. Enter code/name, choose term and multiple classes, set credits and grading, then save once. Catalog defaults do not change existing offering credits.",
          "subjects",
        ],
        [
          "3. Invite and assign teachers",
          "Invite teacher in the top bar creates a code/link. Registration takes Thai and English names and generates a username. New teachers start without student access. Assign courses or homeroom classrooms for the selected term; uncheck to revoke immediately.",
          "assignments",
        ],
        [
          "4. Permanent delete and archive",
          "Delete is irreversible: students include all their grades/enrollments; subjects and offerings include related grades; classes and terms include offerings/enrollments but retain student identities; schemes include courses and grades using them. Archive preserves history and has a separate Restore action. Review the confirmation scope.",
          "subjects",
        ],
        [
          "5. Teacher accounts",
          "Search accounts by Thai/English name or login. Edit to add Thai names to legacy accounts or update contact details. Existing login and password stay the same. Reopen the editor if another person changed the record. Permanent teacher deletion removes login, photo, profile, feedback and assignments without an account recovery copy. Student results remain. Admin/Developer and your own account cannot be removed here.",
          "teachers",
        ],
        [
          "6. School settings",
          "Settings groups school details, theme presets and four colors (including light/dark backgrounds), academics, invitations and grade reset. Presets become Custom when edited. Save to apply school colors; display mode applies to your device. Audit lists changes. Personal details/photo are behind your bottom profile link. The following teacher workflow also applies to administrators.",
          "settings",
        ],
      ];
  const steps = admin ? [...adminSteps, ...teacherSteps] : teacherSteps;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {admin
              ? th
                ? "สำหรับผู้ดูแล"
                : "Administrator guide"
              : th
                ? "สำหรับครู"
                : "Teacher guide"}
          </span>
          <h1>{t("guide")}</h1>
          <p>
            {th
              ? "กดหัวข้อเพื่ออ่านตามงานที่กำลังทำ"
              : "Open a topic for the task you are working on."}
          </p>
        </div>
        <BookOpen size={32} />
      </div>
      <div className="mode-switch">
        <Link className="button" href="/teacher/students">
          {t("byStudent")} <ArrowUpRight size={15} />
        </Link>
        <Link className="button" href="/teacher/gradebook">
          {t("bySubject")} <ArrowUpRight size={15} />
        </Link>
      </div>
      <section className="panel guide-steps">
        {steps.map(([title, body, path], i) => (
          <details key={title} open={i === 0}>
            <summary>{title}</summary>
            <p>{body}</p>
            <Link className="text-link" href={`/teacher/${path}`}>
              {th ? "เปิดหน้านี้" : "Open page"} <ArrowUpRight size={15} />
            </Link>
          </details>
        ))}
      </section>
      <p className="notice">
        {th
          ? "เบต้านี้ยังเปิดให้ครูใช้งานเท่านั้น นักเรียนยังดูเกรดไม่ได้ แม้จะกดประกาศแล้ว"
          : "This beta is for staff. Student access remains closed even after publishing."}
      </p>
    </>
  );
}
