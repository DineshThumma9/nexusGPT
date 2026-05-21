import { create } from "zustand";
import { persist } from "zustand/middleware";

type AuthState = {
  accessToken: string | null; // access token
  refreshToken: string | null; // refresh

  setAccessToken: (token: string | null) => void;

  setRefreshToken: (refreshToken: string | null) => void;
  clearAuth: () => void;
};

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,

      setAccessToken: (accessToken) => set({ accessToken }),

      setRefreshToken: (refreshToken) => set({ refreshToken }),
      clearAuth: () => set({ accessToken: null, refreshToken: null }),
    }),
    {
      name: "auth-persist", // localStorage key
      // Optionally, you can serialize/deserialize or encrypt here
    },
  ),
);

export default useAuthStore;
