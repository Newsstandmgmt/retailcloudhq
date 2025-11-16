import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';

type DevicePermissions = {
  can_scan_barcode?: boolean;
  can_adjust_inventory?: boolean;
  can_create_orders?: boolean;
  can_approve_orders?: boolean;
  can_view_reports?: boolean;
  can_edit_products?: boolean;
  can_manage_devices?: boolean;
  can_transfer_inventory?: boolean;
  can_mark_damaged?: boolean;
  can_receive_inventory?: boolean;
  [key: string]: any;
};

type PermissionsContextValue = {
  role: string | null;
  permissions: DevicePermissions;
  hasPermission: (key: keyof DevicePermissions) => boolean;
  hasAny: (keys: Array<keyof DevicePermissions>) => boolean;
  hasRole: (...roles: string[]) => boolean;
  refresh: () => Promise<void>;
  loading: boolean;
};

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined);

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<DevicePermissions>({});
  const [loading, setLoading] = useState<boolean>(true);

  const load = async () => {
    setLoading(true);
    try {
      const [roleStr, permsStr] = await Promise.all([
        AsyncStorage.getItem('user_role'),
        AsyncStorage.getItem('permissions'),
      ]);
      setRole(roleStr);
      if (permsStr) {
        try {
          setPermissions(JSON.parse(permsStr));
        } catch {
          setPermissions({});
        }
      } else {
        setPermissions({});
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') {
        load().catch(() => {});
      }
    });
    return () => {
      sub.remove();
    };
  }, []);

  const value = useMemo<PermissionsContextValue>(() => {
    const hasPermission = (key: keyof DevicePermissions) => {
      if (role === 'admin' || role === 'super_admin') return true;
      return !!permissions[key];
    };
    const hasAny = (keys: Array<keyof DevicePermissions>) => keys.some(k => hasPermission(k));
    const hasRole = (...roles: string[]) => (role ? roles.includes(role) : false);
    return {
      role,
      permissions,
      hasPermission,
      hasAny,
      hasRole,
      refresh: load,
      loading,
    };
  }, [role, permissions, loading]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = (): PermissionsContextValue => {
  const ctx = useContext(PermissionsContext);
  if (!ctx) {
    throw new Error('usePermissions must be used within PermissionsProvider');
  }
  return ctx;
};

export const RequirePermission: React.FC<{
  anyOf?: Array<keyof DevicePermissions>;
  roleIn?: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ anyOf, roleIn, children, fallback = null }) => {
  const { hasAny, hasRole, loading } = usePermissions();
  if (loading) return null;
  if (roleIn && roleIn.length && hasRole(...roleIn)) return <>{children}</>;
  if (anyOf && anyOf.length && hasAny(anyOf)) return <>{children}</>;
  return <>{fallback}</>;
};

export default PermissionsProvider;


