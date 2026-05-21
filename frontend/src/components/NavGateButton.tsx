import { Button, ButtonGroup, Separator } from "@chakra-ui/react";
import { Link } from "react-router-dom";
interface Props {
  login_register: string;
  message: string;
  isLoading: boolean;
  onSubmit: () => void;
  altlink: string;
}

const NavGateButton = ({
  login_register,
  message,
  isLoading,
  onSubmit,
  altlink,
}: Props) => {
  const buttonGroup = {
    alignSelf: "center",
    alignContent: "center",
    flexDirection: "column" as const,
    alignItems: "stretch",
    gap: 4,
    width: "100%",
  };

  const submitButtonStyles = {
    bg: { base: "brand.700", _dark: "brand.600" },
    color: "white",
    border: "none",
    width: "100%",
    _hover: {
      bg: { base: "brand.800", _dark: "brand.500" },
      transform: "scale(1.02)",
    },
    _active: {
      transform: "scale(0.98)",
    },
    transition: "all 0.2s",
    fontWeight: "600",
    fontSize: "md",
    fontFamily: "body",
    py: 3,
    borderRadius: "lg",
    boxShadow: "sm",
  };

  const outlineButtonStyles = {
    bg: "transparent",
    color: "fg.default",
    border: "1px solid",
    borderColor: "border.default",
    width: "100%",
    _hover: {
      bg: "bg.subtle",
      borderColor: "border.emphasized",
      transform: "scale(1.02)",
    },
    _active: {
      transform: "scale(0.98)",
    },
    transition: "all 0.2s",
    fontWeight: "500",
    fontSize: "md",
    fontFamily: "body",
    py: 3,
    borderRadius: "lg",
  };

  return (
    <ButtonGroup {...buttonGroup}>
      <Button
        onClick={() => onSubmit()}
        loading={isLoading}
        {...submitButtonStyles}
      >
        {login_register}
      </Button>

      <Separator borderColor="border.default" my={2} />

      <Link to={altlink} style={{ width: "100%" }}>
        <Button {...outlineButtonStyles}>{message}</Button>
      </Link>
    </ButtonGroup>
  );
};

export default NavGateButton;
