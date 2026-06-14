import { Plus, Loader2 } from "lucide-react";
import useSessions from "../hooks/useSessions.ts";
import { useState } from "react";
import { Button } from "./ui/button";

const SideBarNav = () => {
  const { createNewSession } = useSessions();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateNewSession = async () => {
    if (isCreating) return;

    setIsCreating(true);
    try {
      const sessionId = await createNewSession();
      console.log("New session created:", sessionId);
    } catch (error) {
      console.error("Failed to create new session:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Button
      onClick={handleCreateNewSession}
      disabled={isCreating}
      variant="default"
      className="w-full h-10 rounded-xl flex gap-2.5 items-center justify-center font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-150 shadow-sm"
    >
      {isCreating ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Plus size={16} />
      )}
      <span className="text-sm">New Chat</span>
    </Button>
  );
};

export default SideBarNav;
