"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { NavigationCache } from "@/lib/navigation-cache";
import type { Meta } from "@/lib/types";
import { api } from "./ui";
const DataContext = createContext<NavigationCache | null>(null);
export function DataProvider({ children }: { children: React.ReactNode }) {
  const [cache] = useState(() => new NavigationCache());
  return <DataContext.Provider value={cache}>{children}</DataContext.Provider>;
}
export function useNavigationData() {
  const cache = useContext(DataContext);
  if (!cache) throw new Error("Missing data context");
  return { prime: async (url: string) => cache.put(url, await api(url)) };
}
export function useLoad<T>(url: string | null) {
  const cache = useContext(DataContext);
  const [version, setVersion] = useState(0);
  const key = `${url}:${version}`;
  const [result, setResult] = useState<{
    key: string;
    url?: string;
    revision?: number;
    data?: T;
    error?: Error;
  }>(() => {
    const data = url ? cache?.peek<T>(url) : undefined;
    return data === undefined
      ? { key: "" }
      : { key, url: url!, data, revision: version };
  });
  useEffect(() => {
    if (!url) return;
    let active = true;
    const prefetched = cache?.take<T>(url);
    (prefetched === undefined ? api<T>(url) : Promise.resolve(prefetched))
      .then((data) => {
        if (active) setResult({ key, url, data, revision: version });
      })
      .catch((error) => {
        if (active)
          setResult((previous) => ({
            key,
            url,
            error,
            data: previous.url === url ? previous.data : undefined,
            revision: previous.url === url ? previous.revision : version,
          }));
      });
    return () => {
      active = false;
    };
  }, [url, key, version, cache]);
  return {
    data:
      result.url === url ? result.data : url ? cache?.peek<T>(url) : undefined,
    error: result.key === key ? result.error : undefined,
    refreshing: !!url && result.key !== key,
    revision: result.url === url ? (result.revision ?? version) : version,
    reload: () => setVersion((v) => v + 1),
  };
}
export const SchoolContext = createContext<{
  meta: Meta;
  term: string;
  setTerm: (v: string) => void;
  refresh: () => void;
  setAvatarUrl: (url: string | null) => void;
  unsaved: boolean;
  setUnsaved: React.Dispatch<React.SetStateAction<boolean>>;
  studentDirection: "next" | "previous";
  setStudentDirection: (direction: "next" | "previous") => void;
} | null>(null);
export function useSchool() {
  const value = useContext(SchoolContext);
  if (!value) throw new Error("Missing school context");
  return value;
}
