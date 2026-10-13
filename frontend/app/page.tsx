import StandingsPage from './standings/page';

export default function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; type?: string }>;
}) {
  return <StandingsPage searchParams={searchParams} />;
}
