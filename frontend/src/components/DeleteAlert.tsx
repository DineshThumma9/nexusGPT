import { Button, Dialog, Portal } from "@chakra-ui/react";
interface Props {
  onCancel: () => void;
  onConfirm: () => void;
}

const DeleteAlert = ({ onConfirm, onCancel }: Props) => {
  const dialogHeader = {
    p: 6,
    pb: 4,
    bg: "bg.panel",
    borderTopRadius: "lg",
  };

  const dialogBody = {
    p: 6,
    pt: 2,
    bg: "bg.panel",
    color: "fg",
  };

  const dialogFooter = {
    p: 6,
    pt: 4,
    gap: 3,
    bg: "bg.panel",
    borderBottomRadius: "lg",
  };

  return (
    <Dialog.Root role="alertdialog" open={true}>
      <Portal>
        <Dialog.Backdrop
          css={{
            bg: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
          }}
        />
        <Dialog.Positioner>
          <Dialog.Content
            css={{
              bg: "bg.panel",
              border: `1px solid ${"border.subtle"}`,
              borderRadius: "lg",
              boxShadow: `0 20px 60px ${"lg"}`,
              maxW: "md",
              mx: 4,
            }}
          >
            <Dialog.Header {...dialogHeader}>
              <Dialog.Title
                css={{
                  fontSize: "xl",
                  fontWeight: "bold",
                  color: "fg",
                  textAlign: "center",
                }}
              >
                Are you sure?
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body {...dialogBody}>
              <p>
                This action cannot be undone. This will permanently delete your
                session and all associated messages.
              </p>
            </Dialog.Body>
            <Dialog.Footer {...dialogFooter}>
              <Dialog.ActionTrigger asChild>
                <Button
                  css={{
                    borderRadius: "12px",
                    border: `1px solid ${"border.subtle"}`,
                    color: "fg",
                    bg: "transparent",
                    px: 6,
                    py: 2,
                    _hover: {
                      bg: "bg.subtle",
                      borderColor: "border",
                    },
                    _active: {
                      transform: "translateY(1px)",
                    },
                    transition: "all 0.2s",
                  }}
                  onClick={onCancel}
                >
                  Cancel
                </Button>
              </Dialog.ActionTrigger>
              <Button
                css={{
                  bg: "fg.error",
                  color: "bg.canvas",
                  borderRadius: "10px",
                  _hover: {
                    bg: "fg.error",
                    opacity: 0.8,
                  },
                }}
                onClick={onConfirm}
              >
                Delete
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

export default DeleteAlert;
