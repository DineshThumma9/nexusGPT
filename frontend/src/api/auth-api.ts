// src/api/auth-api.ts
import { authAPI } from "./apiInstance.ts";

export const login = (data: { username: string; password: string }) => {
  const form = new URLSearchParams();
  form.append("username", data.username);
  form.append("password", data.password);

  return authAPI.post("/login", form, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
};

export const register = async (
  username: string,
  email: string,
  password: string,
) => {
  const response = await authAPI.post(
    "/register",
    { username, email, password },
    { headers: { "Content-Type": "application/json" } },
  );
  return response.data;
};
