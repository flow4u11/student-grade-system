"use client";
import { createContext, useContext } from "react";
type Identity = { id: string; display_name: string; role: string };
const Context = createContext<Identity | null>(null);
export const useStaffIdentity = () => useContext(Context);
export function StaffIdentity({
  profile,
  children,
}: {
  profile: Identity;
  children: React.ReactNode;
}) {
  return <Context.Provider value={profile}>{children}</Context.Provider>;
}
