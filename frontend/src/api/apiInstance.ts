// src/api/base-api.ts
import axios, { type AxiosInstance, AxiosError } from "axios";
import useAuthStore from "../store/authStore";
import useSessionStore from "../store/sessionStore";
import useInitStore from "../store/initStore";
import useValidationStore from "../store/validationStore";

export const API_BASE_URL = import.meta.env.VITE_API_URI;

const handleAuthError = () => {
  console.log("Authentication failed - clearing user session");

  useAuthStore.getState().clearAuth();
  useSessionStore.getState().clearAllSessions();
  useValidationStore.getState().clearAllFields();

  window.location.href = "/login";
};

const addAuthInterceptor = (instance: AxiosInstance) => {
  instance.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
};

const addErrorInterceptor = (
  instance: AxiosInstance,
  apiName: string = "API",
  requiresAuth: boolean = true,
) => {
  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401 && requiresAuth) {
        console.error("Authentication error - token expired or invalid");
        const token = useAuthStore.getState().accessToken;
        if (token) {
          handleAuthError();
        } else {
          console.warn(
            "Bypassed auth mode: skipping redirect and keeping local states.",
          );
        }
        return Promise.reject(new Error("Authentication failed"));
      }

      if (error.response) {
        console.error(
          `${apiName} Response Error: ${error.response.status}`,
          error.response.data,
        );
      } else if (error.request) {
        console.error(
          `${apiName} Request Error:`,
          error.request,
          error.message,
        );
      } else {
        console.error(`${apiName} Error:`, error.message);
      }

      return Promise.reject(error);
    },
  );
};

export const createApiInstance = (
  endpoint: string,
  options: {
    withCredentials?: boolean;
    validateStatus?: (status: number) => boolean;
    apiName?: string;
    requiresAuth?: boolean;
  } = {},
): AxiosInstance => {
  const {
    withCredentials = true,
    validateStatus = (status) => status >= 200 && status < 300,
    apiName = "API",
    requiresAuth = true,
  } = options;

  if (!API_BASE_URL) {
    throw new Error(
      "❌ Missing VITE_API_URI. Check your .env or Vercel env settings.",
    );
  }

  const instance = axios.create({
    baseURL: `${API_BASE_URL}${endpoint}`,
    withCredentials,
    validateStatus,
  });

  if (requiresAuth) {
    addAuthInterceptor(instance);
  }

  addErrorInterceptor(instance, apiName, requiresAuth);

  return instance;
};

export const authAPI = createApiInstance("/auth", {
  apiName: "Auth API",
  requiresAuth: false,
});

export const sessionAPI = createApiInstance("/sessions", {
  apiName: "Session API",
  requiresAuth: true,
});

export const setupAPI = createApiInstance("/setup", {
  apiName: "Setup API",
  requiresAuth: true,
});

export const ragAPI = createApiInstance("/rag", {
  apiName: "RAG API",
  requiresAuth: true,
});
