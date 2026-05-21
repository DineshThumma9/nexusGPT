// src/routes/PrivateRoute.tsx
import { Navigate } from "react-router-dom";
import useAuthStore from "../store/authStore";

export default function PrivateRoute({
  children,
}: {
  children: React.ReactElement;
}) {
  // Temporarily bypassed for backend refactoring
  return children;
  // const token = useAuthStore.getState().accessToken
  // return token ? children : <Navigate to="/login"/>;
}
