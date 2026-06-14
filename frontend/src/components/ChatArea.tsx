// src/components/ChatArea.tsx
import { FiMenu, FiCpu } from "react-icons/fi";
import LLMModelChooser from "./LLMModelChooser";
import AvaterExpandable from "./AvaterExpandable";
import SendRequest from "./SendRequest";
import Response from "./Response";
import { useEffect, useState } from "react";
import sessionStore from "../store/sessionStore.ts";
import { Button } from "./ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";

interface ChatAreaProps {
  onOpenSidebar?: () => void;
}

const ChatArea = ({ onOpenSidebar }: ChatAreaProps) => {
  const [modelChooserOpen, setModelChooserOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = sessionStore.subscribe(() => {});
    return unsubscribe;
  }, []);

  return (
    <div className="flex-1 h-screen bg-background overflow-hidden relative">
      {/* ── Floating header ── */}
      <div className="flex justify-between items-center absolute top-0 left-0 right-0 bg-transparent z-50 px-2 md:px-6 pt-2 md:pt-2">
        <div className="flex gap-1 min-w-0 flex-1 overflow-hidden">
          {/* Hamburger — mobile only */}
          <Button
            aria-label="Open sidebar"
            onClick={onOpenSidebar}
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0"
          >
            <FiMenu className="h-5 w-5" />
          </Button>

          {/* Model chooser toggle — mobile only */}
          <Collapsible
            open={modelChooserOpen}
            onOpenChange={setModelChooserOpen}
            className="md:hidden"
          >
            <CollapsibleTrigger asChild>
              <Button
                aria-label="Toggle model chooser"
                variant={modelChooserOpen ? "default" : "ghost"}
                size="icon"
                className="shrink-0"
              >
                <FiCpu className="h-5 w-5" />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>

          {/* Model chooser — desktop only */}
          <div className="hidden md:block min-w-0">
            <LLMModelChooser />
          </div>
        </div>

        <AvaterExpandable />
      </div>

      {/* Mobile model chooser dropdown */}
      <Collapsible open={modelChooserOpen} className="md:hidden">
        <CollapsibleContent
          className="absolute z-40"
          style={{ top: "50px", left: "8px", right: "8px" }}
        >
          <div className="bg-background p-2 rounded-xl border border-border shadow-md">
            <LLMModelChooser />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ── Messages scroll area — fills full height, padded so content clears header & input ── */}
      <div className="h-full overflow-hidden">
        <Response />
      </div>

      {/* ── Floating input — absolutely pinned at bottom, transparent gap visible ── */}
      <div className="absolute bottom-0 left-0 right-0 z-50 bg-transparent pointer-events-none">
        {/* Re-enable pointer events only on the pill itself (handled inside SendRequest) */}
        <div className="pointer-events-auto">
          <SendRequest />
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
