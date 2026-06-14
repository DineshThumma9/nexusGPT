import { login, register } from "../api/auth-api.ts";
import useValidationStore from "../store/validationStore.ts";
import useAuthStore from "../store/authStore.ts";
import useInitStore from "../store/initStore.ts";
import sessionStore from "../store/sessionStore.ts";
import useSessions from "./useSessions.ts";
import useSessionStore from "../store/sessionStore.ts";

export const useAuth = () => {
  const { createNewSession } = useSessions();
  const { current_session } = useSessionStore();

  const loginUser = async (username: string, password: string) => {
    try {
      const res = await login({ username, password });
      if (!res || !res.data) {
        throw new Error("No response data from login API");
      }

      const { access, refresh } = res.data;

      useAuthStore.getState().setAccessToken(access);
      useAuthStore.getState().setRefreshToken(refresh);
      if (current_session?.length != 0) {
        await createNewSession();
      }

      console.log("Login successful, tokens stored");
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const registerUser = async (
    username: string,
    email: string,
    password: string,
  ) => {
    try {
      console.log("IN useAuth - registering user");
      const res = await register(username, email, password);
      console.log("Registration response:", res);

      // Fixed: check the correct response structure
      if (!res || !res.access || !res.refresh) {
        throw new Error("Missing tokens in register API response");
      }

      const { access, refresh } = res;

      useAuthStore.getState().setAccessToken(access);
      useAuthStore.getState().setRefreshToken(refresh);
      await createNewSession();
      console.log("Registration successful, tokens stored");
    } catch (error) {
      console.error("Registration failed:", error);
      throw error;
    }
  };

  const logoutUser = () => {
    useValidationStore.getState().clearAllFields();
    useInitStore.getState().clearInit();
    sessionStore.getState().clearAllSessions();
    useAuthStore.getState().clearAuth();
  };

  return { login: loginUser, register: registerUser, logout: logoutUser };
};
