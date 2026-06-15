// src/routes/PrivateRoute.tsx
import { Navigate } from "react-router-dom";
import useAuthStore from "../store/authStore";

export default function PrivateRoute({
  children,
}: {
  children: React.ReactElement;
}) {
  const token = useAuthStore((state) => state.accessToken);
  return token ? children : <Navigate to="/login" />;
}
