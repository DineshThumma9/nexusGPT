import { type ReactNode } from "react";
import NavGateButton from "./NavGateButton.tsx";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";

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
    <Card className="w-[400px] max-w-[95vw] bg-card border border-border shadow-sm rounded-2xl z-10 p-6 text-foreground">
      <CardHeader>
        <CardTitle className="text-center text-foreground font-semibold text-xl mb-2">
          {heading}
        </CardTitle>
      </CardHeader>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <CardContent>
          <div className="flex flex-col gap-4">{children}</div>
        </CardContent>

        <CardFooter className="flex justify-center w-full">
          <NavGateButton
            login_register={login_register}
            message={message}
            isLoading={isLoading}
            onSubmit={onSubmit}
            altlink={altlink}
          />
        </CardFooter>
      </form>
    </Card>
  );
};

export default CrediantialCard;
