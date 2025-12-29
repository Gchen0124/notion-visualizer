import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to canvas page for public beta
  // The YearView (Daily Ritual) is available at /year for personal use
  redirect('/canvas');
}
