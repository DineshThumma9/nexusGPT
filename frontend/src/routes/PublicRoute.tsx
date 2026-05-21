// src/routes/PublicRoute.tsx
import { Navigate } from "react-router-dom";
import type { JSX } from "react";
import useAuthStore from "../store/authStore.ts";

export default function PublicRoute({ children }: { children: JSX.Element }) {
  // Temporarily bypassed for backend refactoring
  return children;
  // const token = useAuthStore.getState().accessToken
  // return token ? <Navigate to="/app"/> : children;
}
