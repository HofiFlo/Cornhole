import { redirect } from 'next/navigation';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

export default function Home() {
  redirect(config.appMode === 'public' ? '/anmeldung' : '/admin');
}
