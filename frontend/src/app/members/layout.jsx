export const metadata = {
  title: 'Browse Profiles | Matrimony Platform',
  description: 'Private matrimonial candidate profiles for active members.',
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
