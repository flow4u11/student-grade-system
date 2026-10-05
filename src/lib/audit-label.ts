const actions: Record<string, [string, string]> = {
  INSERT: ["เพิ่มข้อมูล", "Created"],
  UPDATE: ["แก้ไขข้อมูล", "Updated"],
  DELETE: ["ลบข้อมูล", "Deleted"],
  SAVE: ["บันทึกคะแนน", "Saved grades"],
  PUBLISH: ["ประกาศผลการเรียน", "Published results"],
  UNPUBLISH: ["ยกเลิกประกาศผล", "Unpublished results"],
  RESET: ["ล้างข้อมูล", "Reset"],
  RESET_COURSE_GRADES: ["ล้างผลการเรียนรายวิชา", "Reset course grades"],
  HARD_RESET_GRADES: ["ล้างผลการเรียนทั้งภาคเรียน", "Reset term grades"],
  ASSIGN: ["มอบหมายสิทธิ์", "Assigned"],
  UNASSIGN: ["ยกเลิกการมอบหมาย", "Unassigned"],
  IMPORT: ["นำเข้าข้อมูล", "Imported"],
  PERMANENT_DELETE: ["ลบถาวร", "Permanently deleted"],
  DELETE_TEACHER: ["ลบบัญชีครู", "Deleted teacher"],
  ROTATE_INVITE: ["สร้างรหัสเชิญครู", "Created teacher invitation"],
  CLOSE_REGISTRATION: ["ปิดรับสมัครครู", "Closed teacher registration"],
};
export function auditLabel(action: string, locale: string): string {
  return actions[action]?.[locale === "th" ? 0 : 1] || action;
}
