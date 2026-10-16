export const metadata = {
  title: 'Member Directory | Matrimony Web Platform',
  description: 'Private matrimonial member directory for active subscribers.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function MembersLayout({ children }) {
  return <>{children}</>;
}
