/** Public, invented fixtures. This module must never import a database or API client. */
export const demoSubjects = [
  {
    code: "ท10101",
    name: "ภาษาไทย",
    credits: 1.5,
    teacher: "ครูภาษาไทย ตัวอย่าง",
  },
  {
    code: "ค10101",
    name: "คณิตศาสตร์",
    credits: 1.5,
    teacher: "ครูคณิตศาสตร์ ตัวอย่าง",
  },
  {
    code: "ว10101",
    name: "วิทยาศาสตร์",
    credits: 1.5,
    teacher: "ครูวิทยาศาสตร์ ตัวอย่าง",
  },
  {
    code: "อ10101",
    name: "ภาษาอังกฤษ",
    credits: 1,
    teacher: "ครูภาษาอังกฤษ ตัวอย่าง",
  },
];
export type DemoStudent = {
  id: string;
  number: number;
  code: string;
  name: string;
  classroom: string;
  scores: number[];
};
export const demoStudents: DemoStudent[] = [
  {
    id: "demo-1",
    number: 1,
    code: "00001",
    name: "นักเรียน ตัวอย่างหนึ่ง",
    classroom: "ม.1/1",
    scores: [88, 92, 84, 91],
  },
  {
    id: "demo-2",
    number: 2,
    code: "00002",
    name: "นักเรียน ตัวอย่างสอง",
    classroom: "ม.1/1",
    scores: [77, 82, 74, 80],
  },
  {
    id: "demo-3",
    number: 3,
    code: "00003",
    name: "นักเรียน ตัวอย่างสาม",
    classroom: "ม.1/1",
    scores: [62, 65, 72, 68],
  },
  {
    id: "demo-4",
    number: 4,
    code: "00004",
    name: "นักเรียน ตัวอย่างสี่",
    classroom: "ม.1/1",
    scores: [83, 78, 86, 88],
  },
  {
    id: "demo-5",
    number: 1,
    code: "00005",
    name: "นักเรียน ตัวอย่างห้า",
    classroom: "ม.1/2",
    scores: [91, 87, 93, 90],
  },
  {
    id: "demo-6",
    number: 2,
    code: "00006",
    name: "นักเรียน ตัวอย่างหก",
    classroom: "ม.1/2",
    scores: [48, 57, 61, 53],
  },
];
export function demoGrade(score: number): number {
  if (score >= 80) return 4;
  if (score >= 75) return 3.5;
  if (score >= 70) return 3;
  if (score >= 65) return 2.5;
  if (score >= 60) return 2;
  if (score >= 55) return 1.5;
  if (score >= 50) return 1;
  return 0;
}
export function demoGpa(scores: number[]): number {
  const credits = demoSubjects.reduce(
    (total, subject) => total + subject.credits,
    0,
  );
  return (
    scores.reduce(
      (total, score, index) =>
        total + demoGrade(score) * demoSubjects[index].credits,
      0,
    ) / credits
  );
}
export const demoTeachers = demoSubjects.map((subject, index) => ({
  id: `teacher-${index + 1}`,
  name: subject.teacher,
  subject: subject.name,
  homeroom: index === 0 ? "ม.1/1" : index === 1 ? "ม.1/2" : "",
}));
