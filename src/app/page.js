import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function Home() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get('asmita_auth');
  const isAuthenticated = authCookie && authCookie.value === 'true';

  if (isAuthenticated) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}