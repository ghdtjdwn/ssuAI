import type { Metadata } from "next";

// The page is a Client Component, so the route title lives in this segment layout.
export const metadata: Metadata = {
  title: "도서관",
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
