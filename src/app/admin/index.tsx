import { Redirect } from 'expo-router';

/** /admin → painel do administrador. */
export default function AdminIndex() {
  return <Redirect href="/admin/dashboard" />;
}
