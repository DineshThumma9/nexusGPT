"use client";

import { useMemo, useState } from "react";
import { LuFile, LuSearch } from "react-icons/lu";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { cn } from "@/lib/utils";
import {
  FileTree,
  FileTreeFolder,
  FileTreeFile,
  FileTreeIcon,
  FileTreeName,
} from "./ai/file-tree";

export interface GitTreeNode {
  name: string;
  path: string;
  type: "tree" | "blob";
  sha?: string;
  size?: number;
  children?: GitTreeNode[] | null;
}

interface GitExplorerProps {
  files: GitTreeNode[];
  selectedFiles: string[];
  setSelectedFiles: (files: string[]) => void;
}

const GitExplorer = ({
  files,
  selectedFiles,
  setSelectedFiles,
}: GitExplorerProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSelect = (path: string) => {
    if (selectedFiles.includes(path)) {
      setSelectedFiles(selectedFiles.filter((p) => p !== path));
    } else {
      setSelectedFiles([...selectedFiles, path]);
    }
  };

  const handleSelectAll = () => {
    const visiblePaths: string[] = [];
    const traverse = (nodes: GitTreeNode[]) => {
      nodes.forEach((node) => {
        if (node.type === "blob") {
          visiblePaths.push(node.path);
        } else if (node.children) {
          traverse(node.children);
        }
      });
    };
    traverse(filteredFiles);

    const allSelected =
      visiblePaths.length > 0 &&
      visiblePaths.every((path) => selectedFiles.includes(path));

    if (allSelected) {
      setSelectedFiles(
        selectedFiles.filter((path) => !visiblePaths.includes(path)),
      );
    } else {
      const newSelected = [...new Set([...selectedFiles, ...visiblePaths])];
      setSelectedFiles(newSelected);
    }
  };

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;

    const lowerQuery = searchQuery.toLowerCase();

    const filterTree = (nodes: GitTreeNode[]): GitTreeNode[] => {
      return nodes
        .map((node) => {
          if (node.type === "blob") {
            if (node.name.toLowerCase().includes(lowerQuery)) {
              return node;
            }
            return null;
          } else {
            const filteredChildren = node.children
              ? filterTree(node.children)
              : [];
            if (
              filteredChildren.length > 0 ||
              node.name.toLowerCase().includes(lowerQuery)
            ) {
              return { ...node, children: filteredChildren };
            }
            return null;
          }
        })
        .filter(Boolean) as GitTreeNode[];
    };

    return filterTree(files);
  }, [files, searchQuery]);

  const expandedPaths = useMemo(() => {
    if (!searchQuery.trim()) return undefined;

    const paths = new Set<string>();
    const collectPaths = (nodes: GitTreeNode[]) => {
      nodes.forEach((node) => {
        if (node.type === "tree") {
          paths.add(node.path);
          if (node.children) collectPaths(node.children);
        }
      });
    };
    collectPaths(filteredFiles);
    return paths;
  }, [filteredFiles, searchQuery]);

  const renderTree = (nodes: GitTreeNode[]) => {
    return nodes.map((node) => {
      if (node.type === "tree") {
        return (
          <FileTreeFolder key={node.path} path={node.path} name={node.name}>
            {node.children && renderTree(node.children)}
          </FileTreeFolder>
        );
      } else {
        const isSelected = selectedFiles.includes(node.path);
        return (
          <FileTreeFile
            key={node.path}
            path={node.path}
            name={node.name}
            className={cn(
              "justify-between group pr-1",
              isSelected && "bg-muted",
            )}
          >
            <div className="flex items-center gap-1 overflow-hidden">
              <span className="size-4" />
              <FileTreeIcon>
                <LuFile className="size-4 text-muted-foreground" />
              </FileTreeIcon>
              <FileTreeName>{node.name}</FileTreeName>
              {node.size && (
                <span className="text-muted-foreground text-xs ml-2 whitespace-nowrap">
                  {(node.size / 1024).toFixed(1)} KB
                </span>
              )}
            </div>
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => handleSelect(node.path)}
              className={cn(
                "opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0",
                isSelected && "opacity-100",
              )}
              onClick={(e) => e.stopPropagation()}
            />
          </FileTreeFile>
        );
      }
    });
  };

  const visiblePaths: string[] = useMemo(() => {
    const paths: string[] = [];
    const traverse = (nodes: GitTreeNode[]) => {
      nodes.forEach((node) => {
        if (node.type === "blob") paths.push(node.path);
        if (node.children) traverse(node.children);
      });
    };
    traverse(filteredFiles);
    return paths;
  }, [filteredFiles]);

  const allVisibleSelected =
    visiblePaths.length > 0 &&
    visiblePaths.every((path) => selectedFiles.includes(path));

  return (
    <div className="flex flex-col gap-4 max-h-[600px]">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-muted-foreground">
            <LuSearch />
          </div>
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl bg-background/50 border-border"
          />
        </div>

        {visiblePaths.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSelectAll}
            className="rounded-xl hover:bg-muted"
          >
            {allVisibleSelected ? "Deselect All" : "Select All"}
          </Button>
        )}
      </div>

      {selectedFiles.length > 0 && (
        <div className="text-sm text-muted-foreground bg-muted p-2 rounded-lg border border-border">
          {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""}{" "}
          selected
        </div>
      )}

      <div className="flex-1 overflow-auto border border-border rounded-2xl bg-background/50 p-2 min-h-[300px]">
        {filteredFiles.length === 0 ? (
          <div className="flex justify-center items-center h-[100px]">
            <span className="text-muted-foreground">
              {searchQuery ? "No files match your search" : "No files found"}
            </span>
          </div>
        ) : (
          <FileTree
            expanded={expandedPaths}
            onSelect={(path) => {
              const findNode = (
                nodes: GitTreeNode[],
                target: string,
              ): GitTreeNode | null => {
                for (const node of nodes) {
                  if (node.path === target) return node;
                  if (node.children) {
                    const found = findNode(node.children, target);
                    if (found) return found;
                  }
                }
                return null;
              };
              const node = findNode(filteredFiles, path);
              if (node && node.type === "blob") {
                handleSelect(path);
              }
            }}
          >
            {renderTree(filteredFiles)}
          </FileTree>
        )}
      </div>
    </div>
  );
};

export default GitExplorer;
