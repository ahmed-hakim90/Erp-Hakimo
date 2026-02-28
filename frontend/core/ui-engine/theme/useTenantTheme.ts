import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { applyTenantTheme, cacheTenantTheme, loadTenantTheme, readCachedTenantTheme, resolveTheme } from './tenantTheme';

export function useTenantTheme() {
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const userProfile = useAppStore((state) => state.userProfile);

  useEffect(() => {
    let active = true;

    // Apply cached theme first to avoid style flicker before DB theme resolves.
    const cachedTheme = readCachedTenantTheme();
    if (cachedTheme) {
      applyTenantTheme(cachedTheme);
    }

    const bootstrapTheme = async () => {
      const tenantId = (userProfile as { tenantId?: string } | null)?.tenantId;
      const theme = isAuthenticated ? await loadTenantTheme(tenantId) : resolveTheme();
      if (active) {
        applyTenantTheme(theme);
        cacheTenantTheme(theme);
      }
    };

    void bootstrapTheme();

    return () => {
      active = false;
    };
  }, [isAuthenticated, userProfile]);
}
