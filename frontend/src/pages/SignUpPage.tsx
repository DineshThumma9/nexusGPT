import { toast } from "sonner";
import React, { useState, useEffect } from "react";
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

const signUp = z
  .object({
    username: z.string().min(1, "Username is required"),
    email: z.string().email("Invalid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

const SignUpPage = () => {
  const { clearAllFields } = useValidationStore();
  const [isLoading, setIsLoading] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  const username = useFieldForm("username");
  const password = useFieldForm("password");
  const confirmPassword = useFieldForm("confirmPassword"); // Fixed: consistent naming
  const email = useFieldForm("email");

  const { register, logout } = useAuth();
  const navigate = useNavigate();
  const { setUsername, setEmail } = useInitStore();

  useEffect(() => {
    logout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async () => {
    const values = {
      username: String(username.value || ""),
      email: String(email.value || ""),
      password: String(password.value || ""),
      confirmPassword: String(confirmPassword.value || ""),
    };

    const result = signUp.safeParse(values);

    if (!result.success) {
      const { fieldErrors } = result.error.flatten();

      setTimeout(() => {
        if (fieldErrors.username) {
          username.setError(fieldErrors.username[0]);
          username.incrementShakey();
        }
        if (fieldErrors.email) {
          email.setError(fieldErrors.email[0]);
          email.incrementShakey();
        }
        if (fieldErrors.password) {
          password.setError(fieldErrors.password[0]);
          password.incrementShakey();
        }
        if (fieldErrors.confirmPassword) {
          confirmPassword.setError(fieldErrors.confirmPassword[0]);
          confirmPassword.incrementShakey();
        }
      }, 50);

      return;
    }

    setIsLoading(true);

    try {
      await register(username.value, email.value, password.value);
      toast.success("Registration successful! You are now logged in.");
      setUsername(values.username);
      setEmail(values.email);
      setFadeOut(true);
      setTimeout(() => navigate("/app"), 300);
    } catch (error) {
      console.error("Registration error:", error);
      toast.error(
        "Registration Failed: Please check your information and try again",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen relative bg-background overflow-hidden">
      {/* Animated Mesh Gradient Background */}
      <div className="mesh-bg-container" />

      <div className="min-h-screen w-screen flex items-center justify-center p-4 md:p-8 relative z-10">
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
                heading={"Sign Up"}
                login_register={"Register"}
                message={"Already Have an Account? Log In Here"}
                isLoading={isLoading}
                onSubmit={onSubmit}
                altlink={"/login"}
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
                  label="Email"
                  placeholder="Enter Your Email"
                  value={email.value}
                  onChange={email.onChange}
                  onBlur={email.onBlur}
                  error={email.error ?? ""}
                  touched={email.touched}
                  shakey={email.shakey}
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
                <InputField
                  label="Confirm Password"
                  placeholder="Confirm Password"
                  value={confirmPassword.value}
                  onChange={confirmPassword.onChange}
                  onBlur={confirmPassword.onBlur}
                  error={confirmPassword.error ?? ""}
                  touched={confirmPassword.touched}
                  shakey={confirmPassword.shakey}
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

export default SignUpPage;
