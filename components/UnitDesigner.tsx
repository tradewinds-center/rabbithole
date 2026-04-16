"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import {
  Box,
  Flex,
  HStack,
  Text,
  Input,
  Spinner,
  Splitter,
  IconButton,
} from "@chakra-ui/react";
import { FiArrowLeft } from "react-icons/fi";
import { CompletenessMeter } from "./CompletenessMeter";
import { UnitTree } from "./UnitTree";
import { UnitChat } from "./UnitChat";

interface UnitDesignerProps {
  unitId: Id<"units">;
}

export function UnitDesigner({ unitId }: UnitDesignerProps) {
  const unit = useQuery(api.units.get, { id: unitId });
  const lessons = useQuery(api.lessons.listByUnit, { unitId });
  const updateUnit = useMutation(api.units.update);

  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState("");

  if (unit === undefined || lessons === undefined) {
    return (
      <Flex w="100vw" h="100vh" align="center" justify="center">
        <Spinner size="lg" color="violet.500" />
      </Flex>
    );
  }

  if (unit === null) {
    return (
      <Flex w="100vw" h="100vh" align="center" justify="center" direction="column" gap={3}>
        <Text fontFamily="heading" color="charcoal.400">Unit not found</Text>
        <Link href="/teacher?tab=curriculum" style={{ textDecoration: "none" }}>
          <Text
            fontFamily="heading"
            fontSize="sm"
            color="violet.500"
            cursor="pointer"
            _hover={{ textDecoration: "underline" }}
          >
            Back to Curriculum
          </Text>
        </Link>
      </Flex>
    );
  }

  const handleTitleBlur = async () => {
    setEditingTitle(false);
    if (title.trim() && title.trim() !== unit.title) {
      await updateUnit({ id: unitId, title: title.trim() });
    }
  };

  return (
    <Flex direction="column" h="100vh" w="100vw" bg="gray.50">
      {/* Top bar */}
      <Flex
        px={4}
        py={2}
        bg="white"
        borderBottom="1px solid"
        borderColor="gray.200"
        align="center"
        gap={3}
        flexShrink={0}
      >
        <Link href="/teacher?tab=curriculum" style={{ display: "contents" }}>
          <IconButton
            aria-label="Back"
            variant="ghost"
            size="sm"
            color="charcoal.500"
            _hover={{ bg: "gray.100" }}
          >
            <FiArrowLeft size={18} />
          </IconButton>
        </Link>

        {unit.emoji && <Text fontSize="xl">{unit.emoji}</Text>}

        {editingTitle ? (
          <Input
            size="sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleBlur();
              if (e.key === "Escape") setEditingTitle(false);
            }}
            autoFocus
            fontFamily="heading"
            fontWeight="600"
            fontSize="md"
            color="navy.500"
            w="300px"
          />
        ) : (
          <Text
            fontFamily="heading"
            fontWeight="600"
            fontSize="md"
            color="navy.500"
            cursor="pointer"
            _hover={{ color: "violet.500" }}
            onClick={() => {
              setTitle(unit.title);
              setEditingTitle(true);
            }}
          >
            {unit.title}
          </Text>
        )}

        <Box flex={1} />

        <CompletenessMeter unit={unit} lessons={lessons} />
      </Flex>

      {/* Split pane */}
      <Splitter.Root
        flex={1}
        overflow="hidden"
        defaultSize={[55, 45]}
        panels={[
          { id: "tree", minSize: 30 },
          { id: "chat", minSize: 25 },
        ]}
      >
        <Splitter.Panel id="tree">
          <Flex h="full" flexDir="column" overflow="hidden" bg="white">
            <UnitTree unit={unit} lessons={lessons} />
          </Flex>
        </Splitter.Panel>
        <Splitter.ResizeTrigger id="tree:chat" css={{ "--splitter-border-size": "0.5px" }} />
        <Splitter.Panel id="chat">
          <Flex h="full" flexDir="column" overflow="hidden">
            <UnitChat unitId={unitId} />
          </Flex>
        </Splitter.Panel>
      </Splitter.Root>
    </Flex>
  );
}
