"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Box, HStack, VStack, Text, Popover, Portal } from "@chakra-ui/react";
import chroma from "chroma-js";

interface StatusOrbProps {
  pulseScore: number | null;
  lastMessageAt: number | null;
  size?: "sm" | "md" | "lg";
}

const SIZE_MAP = { sm: 14, md: 24, lg: 40 } as const;

const colorScale = chroma
  .scale([
    "#333333", // 0 - near dark (off-task/dead)
    "#e0c84a", // 1 - yellow (minimal)
    "#9999bb", // 2 - cool white/silver (surface)
    "#00b8d4", // 3 - cyan (solid)
    "#3838a8", // 4 - indigo (strong)
    "#a040b0", // 5 - purple (exceptional)
  ])
  .domain([0, 1, 2, 3, 4, 5]);

// Score → label mapping (thresholds are upper bounds)
const SCORE_LABELS: { max: number; label: string }[] = [
  { max: 0.2, label: "Idle" },
  { max: 0.8, label: "Fading" },
  { max: 1.5, label: "Waking Up" },
  { max: 2.5, label: "Warming Up" },
  { max: 3.2, label: "Engaged" },
  { max: 3.8, label: "Locked In" },
  { max: 4.3, label: "Deep Focus" },
  { max: 4.7, label: "On Fire" },
  { max: 5.0, label: "Learning Furiously" },
];

function getScoreLabel(score: number): string {
  for (const entry of SCORE_LABELS) {
    if (score <= entry.max) return entry.label;
  }
  return "Learning Furiously";
}

function computeEffectiveScore(
  pulseScore: number | null,
  lastMessageAt: number | null
): number {
  if (pulseScore == null || lastMessageAt == null) return 0;
  const elapsed = (Date.now() - lastMessageAt) / 1000;
  const decay = Math.exp(-elapsed / 300);
  return pulseScore * decay;
}

function buildOrbStyle(
  heroColor: chroma.Color,
  effectiveScore: number,
  px: number
) {
  const hero = heroColor;
  const c1 = hero.brighten(1.8).hex();
  const c2 = hero.brighten(0.8).hex();
  const c3 = hero.hex();
  const c4 = hero.darken(0.8).hex();
  const c5 = hero.darken(1.8).hex();

  const gradient = `radial-gradient(circle at 35% 35%, ${c1} 0%, ${c2} 25%, ${c3} 50%, ${c4} 75%, ${c5} 100%)`;

  const glowIntensity = Math.max(0, effectiveScore / 5);
  const glowColor = hero.alpha(0.5 * glowIntensity).css();
  const glowMid = hero.alpha(0.25 * glowIntensity).css();
  const glowOuter = hero.alpha(0.1 * glowIntensity).css();
  const insetGlow = hero.brighten(2).alpha(0.3).css();

  const r1 = Math.round(px * 0.2);
  const r2 = Math.round(px * 0.5);
  const r3 = Math.round(px * 0.8);

  const boxShadow = [
    `inset 0 0 ${Math.round(px * 0.3)}px ${insetGlow}`,
    `0 0 ${r1}px ${glowColor}`,
    `0 0 ${r2}px ${glowMid}`,
    `0 0 ${r3}px ${glowOuter}`,
  ].join(", ");

  return { background: gradient, boxShadow };
}

// Build a CSS linear-gradient string from the chroma scale for the popover bar
const GRADIENT_BAR_CSS = (() => {
  const stops = 20;
  const colors: string[] = [];
  for (let i = 0; i <= stops; i++) {
    const val = (i / stops) * 5;
    colors.push(colorScale(val).hex());
  }
  return `linear-gradient(to right, ${colors.join(", ")})`;
})();

/** Reusable pulse score detail panel (score + label + gradient bar) */
export function PulseScoreDetail({
  pulseScore,
  lastMessageAt,
}: {
  pulseScore: number | null;
  lastMessageAt: number | null;
}) {
  const effectiveScore = computeEffectiveScore(pulseScore, lastMessageAt);
  const heroHex = colorScale(effectiveScore).hex();
  const label = getScoreLabel(effectiveScore);
  const markerPct = Math.min(100, Math.max(0, (effectiveScore / 5) * 100));

  return (
    <VStack gap={2} align="stretch">
      <HStack gap={2} align="baseline">
        <Text
          fontSize="2xl"
          fontWeight="700"
          fontFamily="heading"
          lineHeight="1"
          style={{ color: heroHex }}
        >
          {effectiveScore.toFixed(1)}
        </Text>
        <Text
          fontSize="xs"
          fontWeight="600"
          fontFamily="heading"
          style={{ color: heroHex }}
        >
          / 5
        </Text>
      </HStack>
      <Text
        fontSize="sm"
        fontWeight="600"
        fontFamily="heading"
        lineHeight="1.2"
        style={{ color: heroHex }}
      >
        {label}
      </Text>
      <Box mt={1}>
        <Box position="relative" h="10px">
          <Box
            h="6px"
            borderRadius="full"
            position="absolute"
            top="2px"
            left={0}
            right={0}
            style={{ background: GRADIENT_BAR_CSS }}
          />
          <Box
            position="absolute"
            top="0px"
            w="10px"
            h="10px"
            borderRadius="full"
            border="2px solid white"
            shadow="0 0 3px rgba(0,0,0,0.3)"
            style={{
              left: `calc(${markerPct}% - 5px)`,
              background: heroHex,
            }}
          />
        </Box>
        <HStack justify="space-between" mt="2px">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <Text key={n} fontSize="9px" fontFamily="heading" color="charcoal.300">
              {n}
            </Text>
          ))}
        </HStack>
      </Box>
    </VStack>
  );
}

export function StatusOrb({
  pulseScore,
  lastMessageAt,
  size = "md",
}: StatusOrbProps) {
  const px = SIZE_MAP[size];
  const rafRef = useRef<number>(0);
  const orbRef = useRef<HTMLDivElement>(null);
  const [effectiveScore, setEffectiveScore] = useState(() =>
    computeEffectiveScore(pulseScore, lastMessageAt)
  );

  const tick = useCallback(() => {
    const score = computeEffectiveScore(pulseScore, lastMessageAt);
    setEffectiveScore(score);

    if (orbRef.current) {
      const hero = colorScale(score);
      const { background, boxShadow } = buildOrbStyle(hero, score, px);
      orbRef.current.style.background = background;
      orbRef.current.style.boxShadow = boxShadow;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [pulseScore, lastMessageAt, px]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  const breatheScale = 1 + 0.04 * (effectiveScore / 5);
  const breatheDuration = 3 - (effectiveScore / 5) * 1;

  const heroHex = useMemo(
    () => colorScale(effectiveScore).hex(),
    [effectiveScore]
  );
  const label = useMemo(() => getScoreLabel(effectiveScore), [effectiveScore]);
  const markerPct = useMemo(
    () => Math.min(100, Math.max(0, (effectiveScore / 5) * 100)),
    [effectiveScore]
  );

  // Hover-controlled popover
  const [isOpen, setIsOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setIsOpen(true);
  }, []);

  const handleLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setIsOpen(false), 150);
  }, []);

  return (
    <Popover.Root open={isOpen} onOpenChange={(e) => setIsOpen(e.open)} positioning={{ placement: "bottom" }}>
      <Popover.Trigger asChild>
        <Box
          ref={orbRef}
          flexShrink={0}
          w={`${px}px`}
          h={`${px}px`}
          borderRadius="50% 50% 47.5% 47.5% / 52.5% 52.5% 45% 45%"
          position="relative"
          cursor="default"
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          transition="filter 0.2s ease"
          css={{
            animation: `statusOrbBreathe ${breatheDuration}s ease-in-out infinite`,
            "@keyframes statusOrbBreathe": {
              "0%, 100%": { transform: "scale(1)" },
              "50%": { transform: `scale(${breatheScale})` },
            },
            "&:hover": {
              filter: "brightness(1.25)",
              animation: "none",
              transform: `scale(${breatheScale + 0.06})`,
            },
          }}
          _after={{
            content: '""',
            position: "absolute",
            top: "10%",
            left: "18%",
            width: "35%",
            height: "25%",
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)",
            pointerEvents: "none",
          }}
        />
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            bg="white"
            borderRadius="xl"
            shadow="lg"
            border="1px solid"
            borderColor="gray.200"
            p={4}
            w="200px"
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
          >
            <PulseScoreDetail pulseScore={pulseScore} lastMessageAt={lastMessageAt} />
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
