import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Tenant, UserRole } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  role: UserRole | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ token: string; user: User; tenant: Tenant | null }>;
  resetPassword: (email: string, new_password: string) => Promise<{ message: string }>;
  register: (data: {
    business_name: string;
    owner_name: string;
    email: string;
    password: string;
    phone: string;
    location: string;
    address?: string;
    description?: string;
    operating_hours?: string;
  }) => Promise<{ message: string; token?: string; tenant: Tenant; user: User }>;
  loginWithSession: (token: string, user: User, tenant: Tenant) => void;
  logout: () => void;
  impersonatePress: (tenantSlug: string) => Promise<void>;
  switchRole: (role: 'super_admin' | 'owner' | 'staff', tenantSlug?: string) => Promise<void>;
  refreshMe: () => Promise<void>;
  updateUserProfile: (data: {
    name?: string;
    email?: string;
    phone?: string;
    current_password?: string;
    new_password?: string;
  }) => Promise<{ message: string; user: User }>;
  selectedPressSlug: string;
  setSelectedPressSlug: (slug: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('printflow_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedPressSlug, setSelectedPressSlug] = useState<string>('bright-digital-printing');

  const refreshMe = async () => {
    const currentToken = localStorage.getItem('printflow_token');
    if (!currentToken) {
      setUser(null);
      setTenant(null);
      setIsLoading(false);
      return;
    }
    try {
      const data = await api.getMe();
      setUser(data.user);
      setTenant(data.tenant);
      if (data.tenant?.slug) {
        setSelectedPressSlug(data.tenant.slug);
      }
    } catch (err) {
      console.warn('Session expired or invalid, clearing token');
      localStorage.removeItem('printflow_token');
      setToken(null);
      setUser(null);
      setTenant(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshMe();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(email.trim(), password);
      localStorage.setItem('printflow_token', res.token);
      setToken(res.token);
      setUser(res.user);
      setTenant(res.tenant);
      if (res.tenant?.slug) {
        setSelectedPressSlug(res.tenant.slug);
      }
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string, new_password: string) => {
    return await api.resetPassword(email.trim(), new_password);
  };

  const register = async (data: {
    business_name: string;
    owner_name: string;
    email: string;
    password: string;
    phone: string;
    location: string;
    address?: string;
    description?: string;
    operating_hours?: string;
  }) => {
    setIsLoading(true);
    try {
      const res = await api.registerPress(data);
      if (res.token) {
        localStorage.setItem('printflow_token', res.token);
        setToken(res.token);
      }
      if (res.user) {
        setUser(res.user);
      }
      if (res.tenant) {
        setTenant(res.tenant);
        if (res.tenant.slug) {
          setSelectedPressSlug(res.tenant.slug);
        }
      }
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithSession = (newToken: string, newUser: User, newTenant: Tenant) => {
    localStorage.setItem('printflow_token', newToken);
    setToken(newToken);
    setUser(newUser);
    setTenant(newTenant);
    if (newTenant?.slug) {
      setSelectedPressSlug(newTenant.slug);
    }
  };

  const logout = () => {
    localStorage.removeItem('printflow_token');
    setToken(null);
    setUser(null);
    setTenant(null);
  };

  const impersonatePress = async (tenantSlug: string) => {
    setIsLoading(true);
    try {
      const res = await api.adminImpersonate(tenantSlug);
      localStorage.setItem('printflow_token', res.token);
      setToken(res.token);
      setUser(res.user);
      setTenant(res.tenant);
      if (res.tenant?.slug) {
        setSelectedPressSlug(res.tenant.slug);
      }
    } catch (err) {
      console.error('Failed to impersonate press:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const switchRole = async (targetRole: 'super_admin' | 'owner' | 'staff', tenantSlug?: string) => {
    if (user?.role === 'super_admin' && tenantSlug) {
      await impersonatePress(tenantSlug);
    } else {
      await refreshMe();
    }
  };

  const updateUserProfile = async (data: {
    name?: string;
    email?: string;
    phone?: string;
    current_password?: string;
    new_password?: string;
  }) => {
    const res = await api.updateProfile(data);
    if (res.token) {
      localStorage.setItem('printflow_token', res.token);
      setToken(res.token);
    }
    if (res.user) {
      setUser(res.user);
    }
    // Also refresh tenant if name was updated
    await refreshMe();
    return res;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        role: user?.role || null,
        token,
        isLoading,
        login,
        resetPassword,
        register,
        loginWithSession,
        logout,
        impersonatePress,
        switchRole,
        refreshMe,
        updateUserProfile,
        selectedPressSlug,
        setSelectedPressSlug,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
