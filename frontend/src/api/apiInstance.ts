// src/api/base-api.ts
import axios, { type AxiosInstance, AxiosError } from "axios";
import useAuthStore from "../store/authStore";
import useSessionStore from "../store/sessionStore";
import useInitStore from "../store/initStore";
import useValidationStore from "../store/validationStore";

export const API_BASE_URL = import.meta.env.VITE_API_URI;

import { toast } from "sonner";

const handleAuthError = () => {
  console.log("Authentication failed - clearing user session");

  useAuthStore.getState().clearAuth();
  useSessionStore.getState().clearAllSessions();
  useValidationStore.getState().clearAllFields();
  useInitStore.getState().clearInit();

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
        const status = error.response.status;
        const data = error.response.data as any;

        let title = "Error";
        let message = "An unexpected error occurred.";

        // Handle specific error codes gracefully
        if (status === 422) {
          title = "Validation Error";
          message = "Please check the information you entered.";
          if (data?.detail && Array.isArray(data.detail)) {
            message = data.detail.map((err: any) => err.msg).join(", ");
          } else if (typeof data?.detail === "string") {
            message = data.detail;
          }
        } else if (status === 429) {
          title = "Too Many Requests";
          message =
            data?.detail ||
            "You've hit the rate limit for your requesting API Endpoint. Please wait a moment before trying again.";
        } else if (status === 413) {
          title = "File Too Large";
          message =
            data?.detail ||
            "The file you uploaded exceeds the maximum allowed size.";
        } else if (status === 402) {
          title = "Payment Required";
          message =
            data?.detail ||
            "You have exceeded your quota or need to update your payment details for your API Key.";
        } else if (status >= 500) {
          title = "Server Error";
          message =
            "We're experiencing technical difficulties. Please try again later.";
        }

        if ([422, 429, 413, 402, 500].includes(status)) {
          toast.error(title, {
            description: message,
            duration: 5000,
          });
        }

        console.error(`${apiName} Response Error: ${status}`, data);
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
