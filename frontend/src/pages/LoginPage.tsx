import { Flex, Box } from "@chakra-ui/react";
import { toaster } from "../components/ui/toaster.tsx";
import { useState, useEffect } from "react";
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

  const { login } = useAuth();
  const navigate = useNavigate();
  const { setUsername } = useInitStore();

  useEffect(() => {
    clearAllFields();
  }, [clearAllFields]);

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
      toaster.create({
        title: "Success",
        description: "Login successful!",
        type: "success",
        duration: 3000,
      });
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

      toaster.create({
        title: "Login Failed",
        description: "Please check your credentials and try again.",
        type: "error",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box minH="100vh" w="full" position="relative" bg="bg.canvas">
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
        </Fade>
      </Flex>
    </Box>
  );
};

export default LoginPage;
