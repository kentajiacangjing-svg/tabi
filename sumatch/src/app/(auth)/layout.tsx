import { Logo } from "@/components/brand";

/** Sign-in pages: the form, and on wide screens a finished room beside it. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,46%)]">
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-[60px] items-center px-5 sm:px-10 md:h-[68px]">
          <Logo />
        </header>
        <main className="flex flex-1 items-start justify-center px-5 pb-16 pt-8 sm:pt-16">{children}</main>
      </div>
      <aside className="relative hidden p-4 lg:block">
        <div className="sticky top-4 h-[calc(100dvh-2rem)] overflow-hidden rounded-[28px] bg-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/seed/kitchen-1.jpg" alt="" className="size-full object-cover" />
          <div className="scrim-b absolute inset-0" />
          <p className="absolute inset-x-8 bottom-8 text-[26px] font-bold leading-snug text-white">
            住まいの工事を、
            <br />
            迷わず相談。
          </p>
        </div>
      </aside>
    </div>
  );
}
