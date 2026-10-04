// A short-lived handoff between adjacent student pages, scoped to one signed-in
// workspace. Normal visits and refreshes always read fresh server data.
export class NavigationCache {
  private entries = new Map<string, { data: unknown; expires: number }>();
  constructor(private now: () => number = Date.now) {}
  put(url: string, data: unknown) {
    this.entries.clear();
    this.entries.set(url, { data, expires: this.now() + 15_000 });
  }
  peek<T>(url: string): T | undefined {
    const entry = this.entries.get(url);
    if (!entry || entry.expires <= this.now()) return undefined;
    return entry.data as T;
  }
  take<T>(url: string): T | undefined {
    const data = this.peek<T>(url);
    this.entries.delete(url);
    return data;
  }
}
