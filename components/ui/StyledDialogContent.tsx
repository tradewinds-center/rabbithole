import { Dialog } from "@chakra-ui/react";

interface StyledDialogContentProps {
  children: React.ReactNode;
  maxW?: string;
}

export function StyledDialogContent({
  children,
  maxW = "sm"
}: StyledDialogContentProps) {
  return (
    <Dialog.Content maxW={maxW} mx={4} borderRadius="xl" overflow="hidden">
      {children}
    </Dialog.Content>
  );
}
