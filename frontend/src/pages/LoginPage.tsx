import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth.ts";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import useFieldForm from "../hooks/useFieldForm.ts";
import InputField from "../components/InputField.tsx";
import CrediantialCard from "../components/CrediantialCard.tsx";
import useValidationStore from "../store/validationStore.ts";
import useInitStore from "../store/initStore.ts";
import { ColorModeToggle } from "../components/ColorModeToggle.tsx";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const LoginPage = () => {
  const { clearAllFields } = useValidationStore();
  const username = useFieldForm("username");
  const password = useFieldForm("password");

  const [isLoading, setIsLoading] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const { setUsername } = useInitStore();

  useEffect(() => {
    logout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async () => {
    const values = {
      username: username.value,
      password: password.value,
    };

    const result = loginSchema.safeParse(values);

    if (!result.success) {
      const { fieldErrors } = result.error.flatten();

      if (fieldErrors.username) {
        username.setError(fieldErrors.username[0]);
        username.incrementShakey();
      }

      if (fieldErrors.password) {
        password.setError(fieldErrors.password[0]);
        password.incrementShakey();
      }

      return;
    }

    setIsLoading(true);

    try {
      await login(values.username, values.password);
      toast.success("Login successful!");
      setUsername(values.username);
      setFadeOut(true);
      setTimeout(() => navigate("/app"), 300);
    } catch (error) {
      console.error("Login error:", error);

      username.setError("");
      password.setError("");

      setTimeout(() => {
        username.setError("Invalid credentials");
        password.setError("Invalid credentials");
        username.incrementShakey();
        password.incrementShakey();
      }, 50);

      toast.error("Login Failed: Please check your credentials and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative bg-background overflow-hidden">
      {/* Animated Mesh Gradient Background */}
      <div className="mesh-bg-container" />

      <div className="min-h-screen flex items-center justify-center p-4 md:p-8 relative z-10">
        {/* Theme Toggle - positioned in top right */}
        <div className="absolute top-5 right-5 z-[1000]">
          <ColorModeToggle />
        </div>

        <AnimatePresence>
          {!fadeOut && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <CrediantialCard
                heading={"Login"}
                login_register={"Login"}
                message={"Don't have an account? Sign Up"}
                isLoading={isLoading}
                onSubmit={onSubmit}
                altlink={"/signup"}
              >
                <InputField
                  label="Username"
                  placeholder="Enter Your Username"
                  value={username.value}
                  onChange={username.onChange}
                  onBlur={username.onBlur}
                  error={username.error ?? ""}
                  touched={username.touched}
                  shakey={username.shakey}
                />

                <InputField
                  label="Password"
                  placeholder="Enter Your Password"
                  value={password.value}
                  onChange={password.onChange}
                  onBlur={password.onBlur}
                  error={password.error ?? ""}
                  touched={password.touched}
                  shakey={password.shakey}
                  type="password"
                />
              </CrediantialCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LoginPage;
