import { Stack } from 'expo-router';
import { AdminShell } from '../../components/admin/admin-shell';
import { useIsDesktop } from '../../hooks/use-is-desktop';

/**
 * Layout do grupo admin: no mobile é passthrough (Stack igual ao root);
 * no desktop envolve as rotas no painel com sidebar (AdminShell).
 * O Stack é sempre o mesmo elemento — só o wrapper visual muda no resize.
 */
export default function AdminLayout() {
  const isDesktop = useIsDesktop();
  const stack = (
    <Stack screenOptions={{ headerShown: false, animation: isDesktop ? 'none' : 'slide_from_right' }} />
  );
  if (!isDesktop) return stack;
  return <AdminShell>{stack}</AdminShell>;
}
