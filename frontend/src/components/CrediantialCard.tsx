import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Heading,
  Stack,
} from "@chakra-ui/react";
import { type ReactNode } from "react";
import NavGateButton from "./NavGateButton.tsx";

interface Props {
  heading: string;
  children: ReactNode;
  login_register: string;
  message: string;
  isLoading: boolean;
  onSubmit: () => void;
  altlink: string;
}

const CrediantialCard = ({
  heading,
  login_register,
  children,
  message,
  isLoading,
  onSubmit,
  altlink,
}: Props) => {
  return (
    <Card.Root
      w="400px"
      maxW="95vw"
      bg="glass.bg"
      backdropFilter="blur(20px)"
      border="1px solid"
      borderColor="glass.border"
      boxShadow="0 8px 32px 0 rgba(0, 0, 0, 0.1)"
      borderRadius="2xl"
      zIndex={10}
      p={6}
      color="fg.default"
      transition="transform 0.3s ease, box-shadow 0.3s ease"
      _hover={{
        transform: "translateY(-4px)",
        boxShadow: "0 12px 48px 0 rgba(0, 0, 0, 0.15)",
      }}
    >
      <CardHeader>
        <Heading
          as="h1"
          size="lg"
          textAlign="center"
          color="fg.default"
          fontWeight="600"
          fontSize="xl"
          fontFamily="heading"
          mb={2}
        >
          {heading}
        </Heading>
      </CardHeader>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <CardBody>
          <Stack gap={4}>{children}</Stack>
        </CardBody>

        <CardFooter justifyContent="center" w="100%">
          <NavGateButton
            login_register={login_register}
            message={message}
            isLoading={isLoading}
            onSubmit={onSubmit}
            altlink={altlink}
          />
        </CardFooter>
      </form>
    </Card.Root>
  );
};

export default CrediantialCard;
