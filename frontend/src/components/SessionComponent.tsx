import { Edit, MoreVertical, Share, Trash } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import useSessions from "../hooks/useSessions.ts";
import { useState, useRef, useEffect } from "react";
import DeleteAlert from "./DeleteAlert.tsx";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";

interface Props {
  title: string;
  sessionId: string;
  onSelect?: () => void;
  isActive: boolean;
}

const SessionComponent = ({ title, sessionId, onSelect, isActive }: Props) => {
  const { changeTitle, deleteSessionById } = useSessions();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingTitle, setIsUpdatingTitle] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const [dialog, setIsDialog] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleChangeTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(title);
    setIsEditing(true);
  };

  const handleTitleUpdate = async () => {
    const trimmed = editValue.trim();
    setIsEditing(false);

    if (trimmed && trimmed !== title) {
      setIsUpdatingTitle(true);
      try {
        await changeTitle(sessionId, trimmed);
      } catch (error) {
        console.error("Failed to update title:", error);
      } finally {
        setIsUpdatingTitle(false);
      }
    }
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditValue(title);
  };

  const handleDeleteSession = async () => {
    setIsDialog(false);
    setIsDeleting(true);
    try {
      await deleteSessionById(sessionId);
    } catch (err) {
      console.log("Error has occurred", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast("Coming Soon", {
      description: "Share functionality is not implemented yet",
      duration: 2000,
    });
  };

  return (
    <>
      <div
        className={`w-full px-3 py-2 h-[40px] rounded-lg transition-all duration-150 cursor-pointer flex items-center border ${
          isDeleting ? "opacity-50" : "opacity-100"
        } ${
          isActive
            ? "bg-accent border-accent/20 text-accent-foreground font-medium shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
            : "bg-transparent border-transparent text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
        }`}
        onClick={onSelect}
      >
        <div className="flex justify-between items-center w-full h-full">
          {/* Title section - takes available space */}
          <div className="flex-1 min-w-0 mr-2 overflow-hidden flex items-center">
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <Input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleTitleUpdate}
                  disabled={isUpdatingTitle}
                  className="h-7 text-sm font-medium px-2 py-1 bg-background"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      handleEditCancel();
                    }
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleTitleUpdate();
                    }
                  }}
                />
              ) : (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isUpdatingTitle) setIsEditing(true);
                  }}
                  className={`text-sm overflow-hidden whitespace-nowrap text-ellipsis transition-all duration-200 block max-w-full ${
                    isUpdatingTitle
                      ? "opacity-70 cursor-default"
                      : "cursor-text"
                  } ${isActive ? "text-accent-foreground font-semibold" : "text-muted-foreground"}`}
                >
                  {title}
                </div>
              )}
            </div>
          </div>

          {/* Menu button - compact and subtle */}
          <div className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isDeleting || isUpdatingTitle}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                  <span className="sr-only">Session options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem
                  onClick={handleChangeTitleClick}
                  disabled={isUpdatingTitle}
                  className="gap-2 text-sm cursor-pointer"
                >
                  <Edit className="h-3.5 w-3.5" />
                  {isUpdatingTitle ? "Updating..." : "Rename"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleShare}
                  className="gap-2 text-sm cursor-pointer"
                >
                  <Share className="h-3.5 w-3.5" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDialog(true);
                  }}
                  disabled={isDeleting}
                  className="gap-2 text-sm text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                >
                  <Trash className="h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {dialog && (
        <DeleteAlert
          onCancel={() => setIsDialog(false)}
          onConfirm={handleDeleteSession}
        />
      )}
    </>
  );
};

export default SessionComponent;
