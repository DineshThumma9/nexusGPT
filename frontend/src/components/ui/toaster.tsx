"use client";

import {
  Toaster as ChakraToaster,
  Portal,
  Spinner,
  Stack,
  Toast,
  createToaster,
} from "@chakra-ui/react";

export const toaster = createToaster({
  placement: "bottom-end",
  pauseOnPageIdle: true,
  max: 1,
});

export const Toaster = () => {
  return (
    <Portal>
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: "4" }}>
        {(toast) => (
          <Toast.Root
            width={{ md: "sm" }}
            bg={{ base: "white", _dark: "rgba(20, 20, 20, 0.85)" }}
            backdropFilter="blur(24px)"
            border="1px solid"
            borderColor={{ base: "gray.200", _dark: "whiteAlpha.200" }}
            boxShadow="0 20px 40px -10px rgba(0,0,0,0.15)"
            borderRadius="xl"
            p={4}
          >
            {toast.type === "loading" ? (
              <Spinner size="sm" color="brand.500" />
            ) : (
              <Toast.Indicator />
            )}
            <Stack gap="1" flex="1" maxWidth="100%">
              {toast.title && (
                <Toast.Title fontWeight="600" color="fg.default">
                  {toast.title}
                </Toast.Title>
              )}
              {toast.description && (
                <Toast.Description color="fg.muted" fontSize="sm">
                  {toast.description}
                </Toast.Description>
              )}
            </Stack>
            {toast.action && (
              <Toast.ActionTrigger>{toast.action.label}</Toast.ActionTrigger>
            )}
            {toast.closable && <Toast.CloseTrigger />}
          </Toast.Root>
        )}
      </ChakraToaster>
    </Portal>
  );
};
