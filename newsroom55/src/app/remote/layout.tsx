import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Télécommande — Centre de nouvelles",
};

export default function RemoteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
