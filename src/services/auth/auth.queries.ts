import { useQuery } from '@tanstack/react-query';
import { authService } from './auth.service';
import { useAuthStore } from '../../store/auth';

export function useMe() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authService.me,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });
}
