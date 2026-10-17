/** Every navigation fades the page content in (the header and tab bar stay put). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
