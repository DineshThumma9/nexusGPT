"use client";

import {
  Button,
  Dialog,
  Field,
  HStack,
  Input,
  InputGroup,
  Portal,
  useSlotRecipe,
  VStack,
} from "@chakra-ui/react";
import { useState } from "react";
import { v4 } from "uuid";
import useSessionStore from "../store/sessionStore.ts";
import { z } from "zod";
import { gitFilesUpload } from "../api/rag-api.ts";

import { toaster } from "./ui/toaster.tsx";
import { RiArrowRightLine } from "react-icons/ri";
import GitExplorer from "./GitExplorer.tsx";
import { ragAPI } from "../api/apiInstance.ts";

interface Props {
  onCancel: () => void;
  onConfirm: () => void;
}

const dialogHeader = {
  p: 6,
  pb: 4,
};

export const GitRequestSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  commit: z.string().optional(),
  branch: z.string().default("main").optional(),
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
  const dialogBody = {
    p: 6,
    pt: 2,
    color: "fg",
  };

  const dialogFooter = {
    p: 6,
    pt: 4,
    gap: 3,
  };

  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [commit, setCommit] = useState("");
  const [token, setToken] = useState("");

  const [loading, setLoading] = useState(false);
  const [explorer, setExplorer] = useState(false);
  const [files, setFiles] = useState<GitTreeNodeType[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  const { current_session } = useSessionStore();
  const recipe = useSlotRecipe({ key: "dialogHelper" });
  const styles = recipe();

  const inputStyles = {
    borderRadius: "xl",
    border: "1px solid",
    borderColor: "border.default",
    bg: "glass.bg",
    color: "fg",
    _placeholder: { color: "fg.muted" },
    _hover: {
      borderColor: "brand.500",
      bg: "bg.subtle",
    },
    _focus: {
      borderColor: "brand.500",
      boxShadow: "0 0 0 1px token(colors.brand.500)",
      bg: "bg.subtle",
    },
    transition: "all 0.2s ease",
  };

  const handleContinue = async () => {
    if (!owner.trim() || !repo.trim()) {
      toaster.create({
        title: "Missing fields",
        description: "Please provide both owner and repository name.",
        type: "error",
        duration: 3000,
      });
      return;
    }

    setLoading(true);
    try {
      const body = {
        repo: repo.trim(),
        owner: owner.trim(),
        branch: branch.trim() || "main",
        commit: commit.trim() || undefined,
        token: token.trim() || undefined,
      };

      const res = await ragAPI.post("/tree", body, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.data) {
        toaster.create({
          type: "error",
          closable: true,
          description: "Some Error has occurred while continuing",
        });
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
          toaster.create({
            type: "error",
            description: `Some error has occurred parsing file: ${parseResult.error.message}`,
          });
        }
      }

      setFiles(parsedFiles);
      setExplorer(true);
    } catch (error) {
      console.error("Error fetching tree:", error);
      toaster.create({
        type: "error",
        closable: true,
        description: "Failed to fetch repository tree",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGitSelected = async () => {
    if (!owner.trim() || !repo.trim()) {
      toaster.create({
        title: "Missing fields",
        description: "Please provide both owner and repository name.",
        type: "error",
        duration: 3000,
      });
      return;
    }

    if (explorer && selectedFiles.length === 0) {
      toaster.create({
        title: "No files selected",
        description: "Please select at least one file to continue.",
        type: "error",
        duration: 3000,
      });
      return;
    }

    setLoading(true);

    try {
      const res_body = GitRequestSchema.parse({
        owner: owner.trim(),
        repo: repo.trim(),
        commit: commit.trim() || undefined,
        branch: branch.trim() || "main",
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

          toaster.create({
            title: "Connection Failed",
            description:
              "Something went wrong while connecting to the repository.",
            type: "error",
            duration: 5000,
          });
        });
    } catch (error) {
      console.error("Validation error:", error);
      setLoading(false);
      toaster.create({
        title: "Invalid Input",
        description: "Please check your filter inputs.",
        type: "error",
        duration: 3000,
      });
    }
  };

  return (
    <>
      <Dialog.Root role="alertdialog" open={true}>
        <Portal>
          <Dialog.Backdrop
            css={{
              ...styles.backdrop,
              backdropFilter: "blur(8px)",
              bg: "md",
            }}
          />
          <Dialog.Positioner>
            <Dialog.Content
              css={{
                ...styles.content,
                bg: "glass.bg",
                backdropFilter: "blur(24px)",
                border: "1px solid",
                borderColor: "glass.border",
                borderRadius: "3xl",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              }}
            >
              <Dialog.Header {...dialogHeader}>
                <Dialog.Title
                  css={{
                    ...styles.title,
                    color: "fg",
                    fontSize: "2xl",
                    fontWeight: "bold",
                  }}
                >
                  Connect Git Repository
                </Dialog.Title>
              </Dialog.Header>

              <Dialog.Body {...dialogBody}>
                {!explorer ? (
                  <VStack gap={6} align="stretch">
                    {/* Repository URL Preview */}
                    <InputGroup
                      startAddon="https://github.com/"
                      endAddon=".git"
                      css={{
                        "& > div": {
                          bg: "bg.muted",
                          border: "1px solid",
                          borderColor: "border.subtle",
                          borderRadius: "xl",
                          color: "fg.subtle",
                        },
                      }}
                    >
                      <Input
                        placeholder="owner/repository"
                        value={`${owner}/${repo}`}
                        readOnly
                        {...inputStyles}
                      />
                    </InputGroup>

                    {/* Owner and Repository */}
                    <HStack gap={4}>
                      <Field.Root flex={1}>
                        <Field.Label
                          color="fg"
                          fontSize="sm"
                          fontWeight="medium"
                        >
                          Owner *
                        </Field.Label>
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
                          {...inputStyles}
                        />
                      </Field.Root>
                      <Field.Root flex={1}>
                        <Field.Label
                          color="fg"
                          fontSize="sm"
                          fontWeight="medium"
                        >
                          Repository *
                        </Field.Label>
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
                          {...inputStyles}
                        />
                      </Field.Root>
                    </HStack>

                    {/* Branch and Commit */}
                    <HStack gap={4}>
                      <Field.Root flex={1}>
                        <Field.Label
                          color="white"
                          fontSize="sm"
                          fontWeight="medium"
                        >
                          Branch
                        </Field.Label>
                        <Input
                          placeholder="main"
                          value={branch}
                          onChange={(e) => setBranch(e.target.value)}
                          {...inputStyles}
                        />
                      </Field.Root>
                      <Field.Root flex={1}>
                        <Field.Label
                          color="fg"
                          fontSize="sm"
                          fontWeight="medium"
                        >
                          Commit (optional)
                        </Field.Label>
                        <Input
                          placeholder="commit-hash"
                          value={commit}
                          onChange={(e) => setCommit(e.target.value)}
                          {...inputStyles}
                        />
                      </Field.Root>
                    </HStack>

                    {/* Private GitHub Token */}
                    <Field.Root>
                      <Field.Label color="fg" fontSize="sm" fontWeight="medium">
                        Private GitHub Token (optional)
                      </Field.Label>
                      <Input
                        type="password"
                        placeholder="ghp_..."
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        {...inputStyles}
                      />
                    </Field.Root>
                  </VStack>
                ) : (
                  <GitExplorer
                    files={files}
                    selectedFiles={selectedFiles}
                    setSelectedFiles={setSelectedFiles}
                  />
                )}
              </Dialog.Body>

              <Dialog.Footer {...dialogFooter}>
                <Dialog.ActionTrigger asChild>
                  <Button
                    variant="ghost"
                    color={"fg"}
                    borderRadius="xl"
                    _hover={{
                      bg: "bg.subtle",
                    }}
                    onClick={onCancel}
                  >
                    Cancel
                  </Button>
                </Dialog.ActionTrigger>

                <Button
                  bg="brand.600"
                  color="white"
                  borderRadius="xl"
                  _hover={{
                    bg: "brand.700",
                    transform: "translateY(-1px)",
                  }}
                  _active={{
                    transform: "translateY(0)",
                  }}
                  onClick={handleGitSelected}
                  disabled={
                    loading ||
                    !owner.trim() ||
                    !repo.trim() ||
                    (explorer && selectedFiles.length === 0)
                  }
                  loading={loading}
                  loadingText="Connecting..."
                  transition="all 0.2s ease"
                >
                  {explorer ? "Connect Repository" : "Add Files"}
                </Button>

                {!explorer && (
                  <Button
                    variant="outline"
                    borderColor="brand.500"
                    color="brand.600"
                    borderRadius="xl"
                    _hover={{
                      bg: "brand.subtle",
                      transform: "translateY(-1px)",
                    }}
                    _active={{
                      transform: "translateY(0)",
                    }}
                    onClick={handleContinue}
                    disabled={loading || !owner.trim() || !repo.trim()}
                    loading={loading}
                    loadingText="Loading..."
                    transition="all 0.2s ease"
                  >
                    Continue <RiArrowRightLine />
                  </Button>
                )}
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
};

export default GitDialog;
