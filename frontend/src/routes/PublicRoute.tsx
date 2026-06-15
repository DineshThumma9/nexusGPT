// src/routes/PublicRoute.tsx
import { Navigate } from "react-router-dom";
import type { JSX } from "react";
import useAuthStore from "../store/authStore.ts";

export default function PublicRoute({ children }: { children: JSX.Element }) {
  const token = useAuthStore((state) => state.accessToken);
  return token ? <Navigate to="/app" /> : children;
}
