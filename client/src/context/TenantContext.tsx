import React, { createContext, useContext } from 'react';
import type { User } from '../types';

interface TenantContextValue {
  activeTenantId: number;
  setActiveTenantId: (id: number) => void;
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  isOnline: boolean;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export const TenantProvider: React.FC<{ value: TenantContextValue; children: React.ReactNode }> = ({
  value,
  children,
}) => <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;

// eslint-disable-next-line react-refresh/only-export-components
export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used inside TenantProvider');
  return ctx;
}
