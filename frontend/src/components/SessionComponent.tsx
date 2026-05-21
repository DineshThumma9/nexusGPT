import {
  Box,
  createToaster,
  Editable,
  Flex,
  IconButton,
  MenuPositioner,
  Portal,
  Text,
} from "@chakra-ui/react";
import { Edit, MoreVertical, Share, Trash } from "lucide-react";
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from "./ui/menu.tsx";
import useSessions from "../hooks/useSessions.ts";
import { useState } from "react";
import DeleteAlert from "./DeleteAlert.tsx";

const toaster = createToaster({ placement: "top" });

interface Props {
  title: string;
  sessionId: string;
  onSelect?: () => void;
  color: string;
  bg: string;
}

const SessionComponent = ({ title, sessionId, onSelect }: Props) => {
  const { changeTitle, deleteSessionById } = useSessions();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingTitle, setIsUpdatingTitle] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [dialog, setIsDialog] = useState(false);

  const handleChangeTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleTitleUpdate = async (newTitle: string) => {
    const trimmed = newTitle.trim();
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
    toaster.create({
      title: "Coming Soon",
      description: "Share functionality is not implemented yet",
      type: "info",
      duration: 2000,
    });
  };

  return (
    <>
      <Box
        w="100%"
        px={3}
        py={2}
        height="40px"
        color="fg"
        borderRadius="12px"
        transition="all 0.2s ease"
        cursor="pointer"
        bg="transparent"
        border="1px solid transparent"
        onClick={onSelect}
        opacity={isDeleting ? 0.5 : 1}
        _hover={{
          bg: { base: "gray.50", _dark: "gray.800" },
          borderColor: { base: "brand.200", _dark: "brand.700" },
          transform: "translateX(4px)",
          boxShadow: "sm",
        }}
        _active={{
          transform: "translateX(2px)",
        }}
      >
        <Flex justify="space-between" align="center" w="100%" h="100%">
          {/* Title section - takes available space */}
          <Box flex="1" minW={0} mr={2} overflow="hidden">
            <Editable.Root
              value={title}
              edit={isEditing}
              onEditChange={({ edit }) => setIsEditing(edit)}
              onValueCommit={({ value }) => handleTitleUpdate(value)}
              onValueRevert={handleEditCancel}
              disabled={isUpdatingTitle}
              selectOnFocus={true}
            >
              <Editable.Preview
                asChild
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isUpdatingTitle) {
                    setIsEditing(true);
                  }
                }}
              >
                <Text
                  fontSize="sm"
                  fontWeight="medium"
                  color="fg"
                  overflow="hidden"
                  whiteSpace="nowrap"
                  textOverflow="ellipsis"
                  opacity={isUpdatingTitle ? 0.7 : 1}
                  cursor={isUpdatingTitle ? "default" : "text"}
                  maxW="100%"
                  display="block"
                  _hover={{
                    opacity: isUpdatingTitle ? 0.7 : 0.9,
                    color: { base: "brand.700", _dark: "brand.400" },
                  }}
                  transition="all 0.2s ease"
                >
                  {title}
                </Text>
              </Editable.Preview>
              <Editable.Input
                fontSize="sm"
                fontWeight="medium"
                px={2}
                py={1}
                borderRadius="6px"
                color={"fg"}
                bg={"bg.panel"}
                border="1px solid"
                borderColor={"border.subtle"}
                w="100%"
                _focus={{
                  borderColor: "border.emphasized",
                  boxShadow: `0 0 0 1px ${"border.emphasized"}`,
                  outline: "none",
                  bg: "bg.subtle",
                }}
                _hover={{
                  borderColor: "border",
                }}
                transition="all 0.2s ease"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    handleEditCancel();
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const target = e.target as HTMLInputElement;
                    handleTitleUpdate(target.value);
                  }
                }}
              />
            </Editable.Root>
          </Box>

          {/* Menu button - compact and subtle */}
          <Box flexShrink={0}>
            <MenuRoot>
              <MenuTrigger asChild>
                <IconButton
                  onClick={(e) => e.stopPropagation()}
                  disabled={isDeleting || isUpdatingTitle}
                  size="xs"
                  variant="ghost"
                  bg="transparent"
                  color={{ base: "brand.700", _dark: "brand.600" }}
                  w="24px"
                  h="24px"
                  minW="24px"
                  borderRadius="6px"
                  transition="all 0.2s ease"
                  _hover={{
                    bg: { base: "brand.50", _dark: "brand.950" },
                    color: { base: "brand.800", _dark: "brand.500" },
                    transform: "scale(1.1)",
                  }}
                  _active={{
                    bg: { base: "brand.100", _dark: "brand.900" },
                    transform: "scale(0.95)",
                  }}
                  _disabled={{
                    opacity: 0.5,
                    cursor: "not-allowed",
                  }}
                  aria-label="Session options"
                >
                  <MoreVertical size={14} />
                </IconButton>
              </MenuTrigger>
              <Portal>
                <MenuPositioner>
                  <MenuContent
                    bg={"bg.panel"}
                    border={`1px solid ${"border.subtle"}`}
                    borderRadius="8px"
                    boxShadow={`0 4px 12px ${"md"}`}
                    py={1}
                    minW="150px"
                  >
                    <MenuItem
                      value="title"
                      onClick={handleChangeTitleClick}
                      disabled={isUpdatingTitle}
                      color={"fg"}
                      fontSize="sm"
                      px={3}
                      py={2}
                      gap={2}
                      transition="all 0.2s ease"
                      _hover={{
                        bg: { base: "brand.50", _dark: "brand.950" },
                        color: { base: "brand.700", _dark: "brand.300" },
                      }}
                      _disabled={{
                        opacity: 0.5,
                        cursor: "not-allowed",
                      }}
                    >
                      <Edit size={14} />
                      {isUpdatingTitle ? "Updating..." : "Rename"}
                    </MenuItem>
                    <MenuItem
                      value="share"
                      onClick={handleShare}
                      color={"fg"}
                      fontSize="sm"
                      px={3}
                      py={2}
                      gap={2}
                      transition="all 0.2s ease"
                      _hover={{
                        bg: { base: "brand.50", _dark: "brand.950" },
                        color: { base: "brand.700", _dark: "brand.300" },
                      }}
                    >
                      <Share size={14} />
                      Share
                    </MenuItem>
                    <MenuItem
                      value="delete"
                      onClick={() => setIsDialog(true)}
                      disabled={isDeleting}
                      color={"fg"}
                      fontSize="sm"
                      px={3}
                      py={2}
                      gap={2}
                      transition="all 0.2s ease"
                      _hover={{
                        bg: { base: "red.50", _dark: "red.950" },
                        color: { base: "red.700", _dark: "red.300" },
                      }}
                      _disabled={{
                        opacity: 0.5,
                        cursor: "not-allowed",
                      }}
                    >
                      <Trash size={14} />
                      Delete
                    </MenuItem>
                  </MenuContent>
                </MenuPositioner>
              </Portal>
            </MenuRoot>
          </Box>
        </Flex>
      </Box>

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
