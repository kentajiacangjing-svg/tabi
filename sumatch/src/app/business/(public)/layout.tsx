import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function BusinessPublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader business />
      {children}
      <SiteFooter />
    </>
  );
}
