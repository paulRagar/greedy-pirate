/**
 * Root template — remounts on every navigation, giving each screen a
 * fade + rise entrance. The flex classes preserve the layout chain so
 * each page's `flex-1` <main> still fills the fixed shell.
 */
export default function Template({ children }: { children: React.ReactNode }) {
   return <div className='route-enter flex min-h-0 flex-1 flex-col'>{children}</div>;
}
