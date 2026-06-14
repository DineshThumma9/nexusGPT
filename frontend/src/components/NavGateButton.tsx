import { Button } from "./ui/button";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";

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
  return (
    <div className="flex flex-col items-stretch gap-4 w-full">
      <Button
        onClick={onSubmit}
        disabled={isLoading}
        className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-150 font-medium text-sm rounded-xl shadow-sm"
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {login_register}
      </Button>

      <div className="h-px bg-border w-full my-2" />

      <Link to={altlink} className="w-full">
        <Button
          variant="outline"
          className="w-full h-11 border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-150 font-medium text-sm rounded-xl"
        >
          {message}
        </Button>
      </Link>
    </div>
  );
};

export default NavGateButton;
