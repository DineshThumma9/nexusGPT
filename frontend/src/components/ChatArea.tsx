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
import { Badge } from "./ui/badge";

interface ChatAreaProps {
  onOpenSidebar?: () => void;
}

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

export function TokenUsageBadge() {
  const sessions = sessionStore((state) => state.sessions);
  const currentSessionId = sessionStore((state) => state.current_session);

  // Find the active session object
  const activeSession = sessions.find((s) => s.session_id === currentSessionId);

  // Default to 0 if starting a brand new un-saved session
  const tokens = activeSession?.total_tokens || 0;

  if (tokens === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className="text-xs ml-2 bg-secondary/80 text-secondary-foreground hover:bg-secondary border-none font-medium cursor-default"
          >
            {tokens.toLocaleString()} Tokens
          </Badge>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="flex flex-col gap-1 text-xs bg-white"
        >
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground black">Input:</span>
            <span className="font-medium">
              {activeSession?.input_tokens?.toLocaleString() || 0}
            </span>
          </div>
          {activeSession?.cached_input_tokens ? (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground pl-2">↳ Cached:</span>
              <span className="font-medium text-blue-400">
                {activeSession.cached_input_tokens.toLocaleString()}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Output:</span>
            <span className="font-medium">
              {activeSession?.output_tokens?.toLocaleString() || 0}
            </span>
          </div>
          {activeSession?.reasoning_tokens ? (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground pl-2">↳ Reasoning:</span>
              <span className="font-medium text-green-400">
                {activeSession.reasoning_tokens.toLocaleString()}
              </span>
            </div>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
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
          <div className="hidden md:flex min-w-0 items-center gap-2">
            <LLMModelChooser />
            <TokenUsageBadge />
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
          <div className="bg-background p-2 rounded-xl border border-border shadow-md flex flex-col gap-2">
            <LLMModelChooser />
            <TokenUsageBadge />
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
