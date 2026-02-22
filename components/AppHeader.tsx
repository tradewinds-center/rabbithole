import { Flex } from "@chakra-ui/react";

export function AppHeader({ children }: { children: React.ReactNode }) {
  return (
    <Flex
      px={{ base: 4, md: 6 }}
      bg="white"
      borderBottom="1px solid"
      borderColor="gray.200"
      shadow="0 1px 3px rgba(0,0,0,0.06)"
      align="center"
      minH="48px"
      flexShrink={0}
    >
      {children}
    </Flex>
  );
}
