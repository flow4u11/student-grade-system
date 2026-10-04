export function academicYear(year: number, locale: string) {
  return String(locale === "th" ? year + 543 : year);
}
export function canonicalYear(year: number) {
  return year >= 2400 ? year - 543 : year;
}
