import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to dashboard (will be protected by middleware)
  redirect('/dashboard');
}
