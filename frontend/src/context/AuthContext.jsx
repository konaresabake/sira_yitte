import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, api, clearTokens, hasTokens, setUnauthorizedHandler } from '../services/api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

/** Session administrateur : jetons JWT en sessionStorage, profil vérifié auprès de l'API. */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    if (!hasTokens()) { setReady(true); return; }
    api.me().then(setUser).catch(() => clearTokens()).finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    if (!data.user.is_staff) {
      clearTokens();
      throw new ApiError(403, { detail: "Accès réservé à l'administrateur de la boutique." });
    }
    setUser(data.user);
    return data.user;
  }, []);
  const logout = useCallback(async () => { await api.logout(); setUser(null); }, []);

  const value = useMemo(() => ({ user, ready, isAdmin: !!user?.is_staff, login, logout }), [user, ready, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
