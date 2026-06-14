"use client";

import { useState } from "react";
import { v4 } from "uuid";
import useSessionStore from "../store/sessionStore.ts";
import { z } from "zod";
import { gitFilesUpload } from "../api/rag-api.ts";

import { toast } from "sonner";
import { RiArrowRightLine } from "react-icons/ri";
import GitExplorer from "./GitExplorer.tsx";
import { ragAPI } from "../api/apiInstance.ts";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog.tsx";
import { Button } from "./ui/button.tsx";
import { Input } from "./ui/input.tsx";
import { Label } from "./ui/label.tsx";

interface Props {
  onCancel: () => void;
  onConfirm: () => void;
}

export const GitRequestSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  commit: z.string().optional(),
  branch: z.string().default("").optional(),
  dir_include: z.array(z.string()).optional(),
  dir_exclude: z.array(z.string()).optional(),
  file_extension_include: z.array(z.string()).optional(),
  file_extension_exclude: z.array(z.string()).optional(),
  files: z.array(z.string()).optional(),
  token: z.string().optional(),
});

export type GitRequestSchema = z.infer<typeof GitRequestSchema>;

export type GitTreeNodeType = {
  name: string;
  path: string;
  type: "tree" | "blob";
  sha?: string;
  size?: number;
  children?: GitTreeNodeType[] | null;
};

export const GitTreeNodeSchema: z.ZodType<GitTreeNodeType> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    type: z.enum(["tree", "blob"]),
    sha: z.string().optional(),
    size: z.number().optional(),
    children: z.array(GitTreeNodeSchema).nullable().optional(),
  }),
);

const parseGitHubUrl = (url: string) => {
  const cleaned = url.trim();
  if (!cleaned) return null;

  if (
    cleaned.startsWith("http://") ||
    cleaned.startsWith("https://") ||
    cleaned.startsWith("git@")
  ) {
    let path = "";
    if (cleaned.startsWith("git@")) {
      const parts = cleaned.split(":");
      if (parts.length > 1) {
        path = parts[1];
      }
    } else {
      try {
        const urlObj = new URL(cleaned);
        path = urlObj.pathname.startsWith("/")
          ? urlObj.pathname.substring(1)
          : urlObj.pathname;
      } catch (e) {
        path = cleaned.replace(/https?:\/\/github\.com\//, "");
      }
    }

    if (path.endsWith(".git")) {
      path = path.slice(0, -4);
    }

    const pathParts = path.split("/");
    if (pathParts.length >= 2) {
      const parsedOwner = pathParts[0];
      const parsedRepo = pathParts[1];
      let parsedBranch = "main";
      if (pathParts[2] === "tree" && pathParts[3]) {
        parsedBranch = pathParts.slice(3).join("/");
      }
      return { owner: parsedOwner, repo: parsedRepo, branch: parsedBranch };
    }
  } else if (cleaned.includes("/")) {
    const pathParts = cleaned.split("/");
    if (pathParts.length >= 2) {
      const parsedOwner = pathParts[0];
      const parsedRepo = pathParts[1];
      let parsedBranch = "main";
      if (pathParts[2] === "tree" && pathParts[3]) {
        parsedBranch = pathParts.slice(3).join("/");
      }
      return { owner: parsedOwner, repo: parsedRepo, branch: parsedBranch };
    }
  }
  return null;
};

const GitDialog = ({ onConfirm, onCancel }: Props) => {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("");
  const [commit, setCommit] = useState("");
  const [token, setToken] = useState("");

  const [loading, setLoading] = useState(false);
  const [explorer, setExplorer] = useState(false);
  const [files, setFiles] = useState<GitTreeNodeType[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  const { current_session } = useSessionStore();

  const handleContinue = async () => {
    if (!owner.trim() || !repo.trim()) {
      toast.error(
        "Missing fields: Please provide both owner and repository name.",
      );
      return;
    }

    setLoading(true);
    try {
      const body = {
        repo: repo.trim(),
        owner: owner.trim(),
        branch: branch.trim() || undefined,
        commit: commit.trim() || undefined,
        token: token.trim() || undefined,
      };

      const res = await ragAPI.post("/tree", body, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.data) {
        toast.error("Some Error has occurred while continuing");
        throw Error("Some error has occurred");
      }

      const files = res.data;

      const parsedFiles: GitTreeNodeType[] = [];
      for (const file of files) {
        const parseResult = GitTreeNodeSchema.safeParse(file);
        if (parseResult.success) {
          parsedFiles.push(parseResult.data);
        } else {
          console.error("Failed to parse file:", file, parseResult.error);
          toast.error(
            `Some error has occurred parsing file: ${parseResult.error.message}`,
          );
        }
      }

      setFiles(parsedFiles);
      setExplorer(true);
    } catch (error) {
      console.error("Error fetching tree:", error);
      toast.error("Failed to fetch repository tree");
    } finally {
      setLoading(false);
    }
  };

  const handleGitSelected = async () => {
    if (!owner.trim() || !repo.trim()) {
      toast.error(
        "Missing fields: Please provide both owner and repository name.",
      );
      return;
    }

    if (explorer && selectedFiles.length === 0) {
      toast.error(
        "No files selected: Please select at least one file to continue.",
      );
      return;
    }

    setLoading(true);

    try {
      const res_body = GitRequestSchema.parse({
        owner: owner.trim(),
        repo: repo.trim(),
        commit: commit.trim() || undefined,
        branch: branch.trim() || undefined,
        files: explorer ? selectedFiles : undefined,
        token: token.trim() || undefined,
      });

      const new_kb_id = v4();
      useSessionStore.getState().setKbId(new_kb_id);
      useSessionStore.getState().setContext("code");
      if (current_session) {
        useSessionStore.getState().updateSession(current_session, {
          kb_id: new_kb_id,
          source_type: "github",
        });
      }

      useSessionStore.getState().setIsWaitingForIndexing(true);

      // Close dialog immediately (Optimistic UI)
      onConfirm();

      // Fire off request in the background
      gitFilesUpload(res_body, current_session, new_kb_id)
        .then((data) => {
          if (data && data.kb_id) {
            useSessionStore.getState().setKbId(data.kb_id);
            if (current_session) {
              useSessionStore.getState().updateSession(current_session, {
                kb_id: data.kb_id,
                source_type: "github",
              });
            }
          }
        })
        .catch((error) => {
          console.error("Git upload error:", error);

          // Revert global state if it fails
          useSessionStore.getState().setIsWaitingForIndexing(false);

          toast.error(
            "Connection Failed: Something went wrong while connecting to the repository.",
          );
        });
    } catch (error) {
      console.error("Validation error:", error);
      setLoading(false);
      toast.error("Invalid Input: Please check your filter inputs.");
    }
  };

  return (
    <Dialog open={true} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="bg-background/90 backdrop-blur-3xl border border-border/40 rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] w-full max-w-lg p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-foreground text-2xl font-bold">
            Connect Git Repository
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-2 text-foreground">
          {!explorer ? (
            <div className="flex flex-col gap-6">
              {/* Repository URL Preview */}
              <div className="flex items-center rounded-xl border border-border bg-muted text-muted-foreground overflow-hidden">
                <div className="px-3 py-2 bg-muted/50 border-r border-border text-sm flex-shrink-0">
                  https://github.com/
                </div>
                <Input
                  placeholder="owner/repository"
                  value={owner && repo ? `${owner}/${repo}` : ""}
                  readOnly
                  className="border-none shadow-none rounded-none focus-visible:ring-0 bg-transparent"
                />
                <div className="px-3 py-2 bg-muted/50 border-l border-border text-sm flex-shrink-0">
                  .git
                </div>
              </div>

              {/* Owner and Repository */}
              <div className="flex flex-col md:flex-row gap-4 w-full">
                <div className="flex-1 space-y-2">
                  <Label className="text-sm font-medium text-foreground">
                    Owner *
                  </Label>
                  <Input
                    placeholder="github-username"
                    value={owner}
                    onChange={(e) => {
                      const val = e.target.value;
                      const parsed = parseGitHubUrl(val);
                      if (parsed) {
                        setOwner(parsed.owner);
                        setRepo(parsed.repo);
                        if (parsed.branch) setBranch(parsed.branch);
                      } else {
                        setOwner(val);
                      }
                    }}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label className="text-sm font-medium text-foreground">
                    Repository *
                  </Label>
                  <Input
                    placeholder="repo-name"
                    value={repo}
                    onChange={(e) => {
                      const val = e.target.value;
                      const parsed = parseGitHubUrl(val);
                      if (parsed) {
                        setOwner(parsed.owner);
                        setRepo(parsed.repo);
                        if (parsed.branch) setBranch(parsed.branch);
                      } else {
                        setRepo(val);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Branch and Commit */}
              <div className="flex flex-col md:flex-row gap-4 w-full">
                <div className="flex-1 space-y-2">
                  <Label className="text-sm font-medium text-foreground">
                    Branch
                  </Label>
                  <Input
                    placeholder="main"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label className="text-sm font-medium text-foreground">
                    Commit (optional)
                  </Label>
                  <Input
                    placeholder="commit-hash"
                    value={commit}
                    onChange={(e) => setCommit(e.target.value)}
                  />
                </div>
              </div>

              {/* Private GitHub Token */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  Private GitHub Token (optional)
                </Label>
                <Input
                  type="password"
                  placeholder="ghp_..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <GitExplorer
              files={files}
              selectedFiles={selectedFiles}
              setSelectedFiles={setSelectedFiles}
            />
          )}
        </div>

        <DialogFooter className="p-6 pt-4 flex flex-col sm:flex-row flex-wrap gap-3">
          <Button
            variant="ghost"
            onClick={onCancel}
            className="w-full sm:w-auto rounded-xl hover:bg-muted"
          >
            Cancel
          </Button>

          <Button
            onClick={handleGitSelected}
            disabled={
              loading ||
              !owner.trim() ||
              !repo.trim() ||
              (explorer && selectedFiles.length === 0)
            }
            className="w-full sm:w-auto bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 hover:-translate-y-px active:translate-y-0 transition-all duration-200"
          >
            {loading
              ? "Connecting..."
              : explorer
                ? "Connect Repository"
                : "Add Files"}
          </Button>

          {!explorer && (
            <Button
              variant="outline"
              onClick={handleContinue}
              disabled={loading || !owner.trim() || !repo.trim()}
              className="w-full sm:w-auto border-primary/50 text-primary rounded-xl hover:bg-primary/10 hover:-translate-y-px active:translate-y-0 transition-all duration-200"
            >
              {loading ? "Loading..." : "Continue"}{" "}
              <RiArrowRightLine className="ml-2" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GitDialog;
