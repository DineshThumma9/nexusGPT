import { useState } from "react";
import { BiLogOut, BiUser } from "react-icons/bi";
import { Github, Key, Blocks } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth.ts";
import useInitStore from "../store/initStore.ts";
import useSessionStore from "../store/sessionStore.ts";

import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

import { ColorModeToggle } from "./ColorModeToggle";
import GitDialog from "./GitDialog.tsx";
import { McpConfigDialog } from "./McpConfigDialog.tsx";

const AvaterExpandable = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { username, email } = useInitStore();
  const { mcpEnabled, setMcpEnabled } = useSessionStore();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const [dialog, setDialog] = useState(false);
  const [mcpDialogOpen, setMcpDialogOpen] = useState(false);
  const [mcpError, setMcpError] = useState(false);

  const handleGitDialog = () => {
    setDialog(false);
  };

  return (
    <div className="flex pr-1 md:pr-2 gap-1 md:gap-1 items-center">
      <div className="flex gap-1">
        <TooltipProvider>
          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDialog(true)}
                className="text-primary hover:bg-primary/10 hover:text-primary transition-all hover:scale-105 active:scale-95 bg-transparent h-10 w-10 md:h-12 md:w-12"
                aria-label="Git Credentials"
              >
                <Github className="h-6 w-6 md:h-7 md:w-7" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Git Credentials</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/app/api-keys")}
                className="text-primary hover:bg-primary/10 hover:text-primary transition-all hover:scale-105 active:scale-95 bg-transparent h-10 w-10 md:h-12 md:w-12"
                aria-label="API Settings"
              >
                <Key className="h-6 w-6 md:h-7 md:w-7" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>API Key Settings</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMcpEnabled(!mcpEnabled)}
                onDoubleClick={() => {
                  setMcpDialogOpen(true);
                  setMcpError(false);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMcpDialogOpen(true);
                  setMcpError(false);
                }}
                className={`transition-all hover:scale-105 active:scale-95 bg-transparent h-10 w-10 md:h-12 md:w-12 ${
                  mcpError
                    ? "text-red-500 border-2 border-red-500 hover:bg-red-100 hover:text-red-600"
                    : mcpEnabled
                      ? "text-green-500 hover:bg-green-500/10 hover:text-green-600"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
                aria-label="Toggle MCP"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={32}
                  height={32}
                  fill={"currentColor"}
                  viewBox={"0 0 24 24"}
                >
                  <path d="m19.97,11.84c.66-.66,1.02-1.53,1.02-2.46s-.36-1.8-1.02-2.46l-.04-.04c-.66-.66-1.53-1.02-2.46-1.02-.17,0-.34.03-.51.05.02-.17.05-.33.05-.51,0-.93-.36-1.8-1.02-2.46-.66-.66-1.53-1.02-2.46-1.02s-1.8.36-2.46,1.02l-7.87,7.87c-.27.27-.27.71,0,.98s.71.27.98,0l7.87-7.87c.39-.39.92-.61,1.47-.61s1.08.22,1.47.61c.39.39.61.92.61,1.48s-.22,1.08-.61,1.48l-5.86,5.86-.08.08c-.27.27-.27.71,0,.98.14.14.31.2.49.2s.36-.07.49-.2l5.94-5.94c.39-.39.92-.61,1.48-.61s1.08.22,1.47.61l.04.04c.39.39.61.92.61,1.47s-.22,1.08-.61,1.48l-7.11,7.11c-.63.63-.63,1.66,0,2.29l1.46,1.46c.14.14.31.2.49.2s.36-.07.49-.2c.27-.27.27-.71,0-.98l-1.46-1.46c-.09-.09-.09-.24,0-.33l7.11-7.11Z" />
                  <path d="m17.96,9.83c.27-.27.27-.71,0-.98-.27-.27-.71-.27-.98,0l-5.82,5.82c-.81.81-2.14.81-2.95,0-.81-.81-.81-2.14,0-2.95l5.82-5.82c.27-.27.27-.71,0-.98-.27-.27-.71-.27-.98,0l-5.82,5.82c-1.36,1.36-1.36,3.56,0,4.92.68.68,1.57,1.02,2.46,1.02s1.78-.34,2.46-1.02l5.82-5.82Z" />
                </svg>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>
                {mcpError
                  ? "MCP config error — right-click to fix"
                  : mcpEnabled
                    ? "Active (Click to disable, right-click/double-click for config)"
                    : "Inactive (Click to enable, right-click/double-click for config)"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <TooltipProvider>
        <Tooltip delayDuration={400}>
          <TooltipTrigger asChild>
            <div>
              <ColorModeToggle />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Toggle Light / Dark Mode</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="flex flex-col gap-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="rounded-full border-border/50 bg-background/50 shadow-sm backdrop-blur-md transition-all hover:bg-muted hover:-translate-y-0.5 hover:scale-105 hover:shadow-md hover:border-primary p-0 min-w-0 h-12 w-12"
            >
              <Avatar className="h-10 w-10 bg-primary text-primary-foreground">
                <AvatarImage src="" />
                <AvatarFallback className="font-semibold text-md bg-primary text-primary-foreground">
                  {username ? username.charAt(0).toUpperCase() : "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 bg-background/80 backdrop-blur-xl border-border/50 shadow-lg rounded-xl"
          >
            <DropdownMenuItem className="py-2.5 px-3 cursor-default hover:bg-muted hover:translate-x-0.5 transition-all focus:bg-muted focus:translate-x-0.5">
              <BiUser className="mr-2 h-4 w-4 text-primary" />
              <span className="font-medium">{username || "User"}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-border/50" />

            <DropdownMenuItem className="py-2.5 px-3 cursor-default hover:bg-muted hover:translate-x-0.5 transition-all focus:bg-muted focus:translate-x-0.5">
              <span className="pl-6 text-xs text-muted-foreground w-full break-all">
                {email || "No email"}
              </span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-border/50" />

            <DropdownMenuItem
              onClick={handleLogout}
              className="py-2.5 px-3 cursor-pointer text-red-600 focus:text-red-50 focus:bg-red-500 hover:text-red-50 hover:bg-red-500 hover:translate-x-0.5 transition-all focus:translate-x-0.5 dark:text-red-400 dark:focus:bg-red-600 dark:hover:bg-red-600"
            >
              <BiLogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {dialog && (
          <GitDialog
            onCancel={() => setDialog(false)}
            onConfirm={handleGitDialog}
          />
        )}

        {mcpDialogOpen && (
          <McpConfigDialog
            onClose={() => setMcpDialogOpen(false)}
            onError={() => {
              setMcpError(true);
              setMcpDialogOpen(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default AvaterExpandable;
