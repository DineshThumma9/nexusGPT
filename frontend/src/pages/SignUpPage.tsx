import { Flex, Box } from "@chakra-ui/react";
import { toaster } from "../components/ui/toaster.tsx";
import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth.ts";
import { useNavigate } from "react-router-dom";
import { Fade } from "@chakra-ui/transition";
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
  }, [logout]);

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
      toaster.create({
        title: "Success",
        description: "Registration successful! You are now logged in.",
        type: "success",
        duration: 3000,
      });
      setUsername(values.username);
      setEmail(values.email);
      setFadeOut(true);
      setTimeout(() => navigate("/app"), 300);
    } catch (error) {
      console.error("Registration error:", error);
      toaster.create({
        title: "Registration Failed",
        description: "Please check your information and try again",
        type: "error",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box minH="100vh" minW="100vw" position="relative" bg="bg.canvas">
      {/* Animated Mesh Gradient Background */}
      <Box
        position="absolute"
        inset={0}
        zIndex={0}
        overflow="hidden"
        bg="bg.canvas"
        _before={{
          content: '""',
          position: "absolute",
          top: "-50%",
          left: "-50%",
          width: "200%",
          height: "200%",
          background: {
            base: "radial-gradient(circle at 50% 50%, token(colors.brand.100) 0%, transparent 50%), radial-gradient(circle at 80% 20%, token(colors.emerald.100) 0%, transparent 50%), radial-gradient(circle at 20% 80%, token(colors.brand.50) 0%, transparent 50%)",
            _dark:
              "radial-gradient(circle at 50% 50%, token(colors.brand.950) 0%, transparent 50%), radial-gradient(circle at 80% 20%, token(colors.emerald.900) 0%, transparent 50%), radial-gradient(circle at 20% 80%, token(colors.brand.900) 0%, transparent 50%)",
          },
          animation: "rotate 20s linear infinite",
        }}
        css={{
          "@keyframes rotate": {
            from: { transform: "rotate(0deg)" },
            to: { transform: "rotate(360deg)" },
          },
        }}
      />

      <Flex
        minH="100vh"
        minW="100vw"
        align="center"
        justify="center"
        p={{ base: 4, md: 8 }}
        position="relative"
        zIndex={1}
      >
        {/* Theme Toggle - positioned in top right */}
        <Box position="absolute" top="20px" right="20px" zIndex={1000}>
          <ColorModeToggle />
        </Box>

        <Fade
          in={!fadeOut}
          unmountOnExit
          transition={{ exit: { duration: 0.3 } }}
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
        </Fade>
      </Flex>
    </Box>
  );
};

export default SignUpPage;
