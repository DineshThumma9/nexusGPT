"use client";

import {
  Box,
  Breadcrumb,
  Button,
  Checkbox,
  HStack,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { LuChevronRight, LuFile, LuFolder, LuSearch } from "react-icons/lu";
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
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const flatFileMap = useMemo(() => {
    const map = new Map<string, GitTreeNode>();

    const traverse = (nodes: GitTreeNode[]) => {
      nodes.forEach((node) => {
        map.set(node.path, node);
        if (node.children) {
          traverse(node.children);
        }
      });
    };

    traverse(files);
    return map;
  }, [files]);

  const currentNodes = useMemo(() => {
    if (currentPath.length === 0) {
      return files;
    }

    const currentPathString = currentPath.join("/");
    const currentNode = flatFileMap.get(currentPathString);
    return currentNode?.children || [];
  }, [currentPath, files, flatFileMap]);

  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) {
      return currentNodes;
    }

    return currentNodes.filter((node) =>
      node.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [currentNodes, searchQuery]);

  const handleNodeClick = (node: GitTreeNode) => {
    if (node.type === "tree") {
      const newPath = node.path.split("/").filter(Boolean);
      setCurrentPath(newPath);
    } else {
      const isSelected = selectedFiles.includes(node.path);
      if (isSelected) {
        setSelectedFiles(selectedFiles.filter((path) => path !== node.path));
      } else {
        setSelectedFiles([...selectedFiles, node.path]);
      }
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setCurrentPath([]);
    } else {
      setCurrentPath(currentPath.slice(0, index + 1));
    }
  };

  const handleSelectAll = () => {
    const visibleFiles = filteredNodes.filter((node) => node.type === "blob");
    const visibleFilePaths = visibleFiles.map((file) => file.path);

    const allSelected = visibleFilePaths.every((path) =>
      selectedFiles.includes(path),
    );

    if (allSelected) {
      setSelectedFiles(
        selectedFiles.filter((path) => !visibleFilePaths.includes(path)),
      );
    } else {
      const newSelected = [...new Set([...selectedFiles, ...visibleFilePaths])];
      setSelectedFiles(newSelected);
    }
  };

  const breadcrumbItems = useMemo(() => {
    return currentPath.map((segment, index) => ({
      name: segment,
      index,
    }));
  }, [currentPath]);

  const visibleFiles = filteredNodes.filter((node) => node.type === "blob");
  const allVisibleSelected =
    visibleFiles.length > 0 &&
    visibleFiles.every((file) => selectedFiles.includes(file.path));

  return (
    <VStack gap={4} align="stretch" maxH="500px">
      {/* Search and Controls */}
      <HStack gap={3}>
        <Box position="relative" flex={1}>
          <Box
            position="absolute"
            left="12px"
            top="50%"
            transform="translateY(-50%)"
            zIndex={1}
            color={"fg.subtle"}
          >
            <LuSearch />
          </Box>
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            pl="40px"
            borderRadius="xl"
            border="1px solid"
            borderColor="border.subtle"
            bg="glass.bg"
            color="fg"
            _placeholder={{ color: "fg.subtle" }}
            _hover={{
              borderColor: "brand.500",
            }}
            _focus={{
              borderColor: "brand.500",
              boxShadow: "0 0 0 1px token(colors.brand.500)",
            }}
          />
        </Box>

        {visibleFiles.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            color={"fg"}
            onClick={handleSelectAll}
            borderRadius="xl"
            _hover={{ bg: "bg.subtle" }}
          >
            {allVisibleSelected ? "Deselect All" : "Select All"}
          </Button>
        )}
      </HStack>

      {/* Breadcrumb Navigation */}
      <Breadcrumb.Root gap="8px" fontSize="sm">
        <Breadcrumb.Item>
          <Breadcrumb.Link
            onClick={() => handleBreadcrumbClick(-1)}
            color={"fg.subtle"}
            _hover={{ color: "fg" }}
            display="flex"
            alignItems="center"
            gap="4px"
          >
            Root
          </Breadcrumb.Link>
        </Breadcrumb.Item>
        {breadcrumbItems.map(({ name, index }) => (
          <Breadcrumb.Item key={index}>
            <Box color={"fg.muted"}>
              <LuChevronRight />
            </Box>
            <Breadcrumb.Link
              onClick={() => handleBreadcrumbClick(index)}
              color={"fg.subtle"}
              _hover={{ color: "fg" }}
              ml={2}
            >
              {name}
            </Breadcrumb.Link>
          </Breadcrumb.Item>
        ))}
      </Breadcrumb.Root>

      {/* Selection Summary */}
      {selectedFiles.length > 0 && (
        <Text
          fontSize="sm"
          color={"fg.subtle"}
          bg={"bg.subtle"}
          p={2}
          borderRadius="lg"
          border={`1px solid ${"border.subtle"}`}
        >
          {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""}{" "}
          selected
        </Text>
      )}

      {/* File Tree */}
      <Box
        flex={1}
        overflow="auto"
        border="1px solid"
        borderColor="border.subtle"
        borderRadius="2xl"
        bg="glass.bg"
        p={2}
        maxH="300px"
      >
        {filteredNodes.length === 0 ? (
          <HStack justify="center" align="center" h="100px">
            <Text color={"fg.subtle"}>
              {searchQuery ? "No files match your search" : "No files found"}
            </Text>
          </HStack>
        ) : (
          <VStack align="stretch" gap={1}>
            {filteredNodes.map((node) => (
              <HStack
                key={node.path}
                p={2}
                borderRadius="lg"
                _hover={{ bg: "bg.subtle" }}
                cursor="pointer"
                onClick={() => handleNodeClick(node)}
                justify="space-between"
                w="full"
                transition="background-color 0.2s"
              >
                <HStack gap={3} flex={1}>
                  {node.type === "tree" ? (
                    <>
                      <Box color="brand.500">
                        <LuFolder size={18} />
                      </Box>
                      <Text
                        color="fg.default"
                        fontSize="sm"
                        fontWeight="medium"
                      >
                        {node.name}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Box color="fg.muted">
                        <LuFile size={16} />
                      </Box>
                      <Text color="fg.default" fontSize="sm">
                        {node.name}
                      </Text>
                      {node.size && (
                        <Text color="fg.subtle" fontSize="xs">
                          {(node.size / 1024).toFixed(1)} KB
                        </Text>
                      )}
                    </>
                  )}
                </HStack>

                {node.type === "blob" && (
                  <Checkbox.Root
                    colorScheme="green"
                    checked={selectedFiles.includes(node.path)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNodeClick(node);
                    }}
                  />
                )}
              </HStack>
            ))}
          </VStack>
        )}
      </Box>
    </VStack>
  );
};

export default GitExplorer;
