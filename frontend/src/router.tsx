// src/router.tsx
import { createBrowserRouter } from "react-router-dom";
import ErrorPage from "./pages/ErrorPage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import SignUpPage from "./pages/SignUpPage.tsx";
import Layout from "./pages/Layout.tsx";
import ChatPage from "./pages/ChatPage.tsx";
import PublicRoute from "./routes/PublicRoute";
import PrivateRoute from "./routes/PrivateRoute";
import ApiKeysPage from "./pages/ApiKeysPage.tsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: (
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        ),
      },
      {
        path: "login",
        element: (
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        ),
      },
      {
        path: "signup",
        element: (
          <PublicRoute>
            <SignUpPage />
          </PublicRoute>
        ),
      },
      {
        path: "app",
        element: (
          <PrivateRoute>
            <ChatPage />
          </PrivateRoute>
        ),
      },
      {
        path: "app/api-keys",
        element: (
          <PrivateRoute>
            <ApiKeysPage />
          </PrivateRoute>
        ),
      },
    ],
  },
]);

export default router;
