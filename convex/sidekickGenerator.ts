"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { generateAndStoreRecraftImage } from "./lib/recraft";

function buildAvatarPrompt(animal: string, color: string): string {
  const fullPrompt = `Flat vector illustration of a friendly anthropomorphized ${animal} face, front facing, extreme close-up cropped so the head and shoulders fill the entire canvas and extend beyond the frame edges. Simple origami style with only 10-15 large paper folds, very few flat facets, bold creases, like a paper craft made by a child, extremely minimal and abstract, with no other texture or detail except for large anime-style eyes. ${color} color palette, no gradients, no shading, no texture, no fine detail, no realistic features. Solid contrasting background.`;
  return fullPrompt.slice(0, 900);
}

function buildHabitatPrompt(animal: string, color: string): string {
  const fullPrompt = `Flat vector illustration of a natural habitat for a ${animal}, wide panoramic format. Simple origami paper craft style with only 10-15 large geometric shapes, very few flat facets, bold creases, extremely minimal and abstract. No creatures, no characters, no animals - only environmental elements. ${color} color palette with complementary tones. No gradients, no shading, no texture, no fine detail. Wide format suitable for a header banner.`;
  return fullPrompt.slice(0, 900);
}

/**
 * Generate sidekick avatar and habitat using Recraft.
 */
export const generateSidekickAvatar = internalAction({
  args: {
    sidekickId: v.id("sidekicks"),
    animal: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(`[SidekickGen] Generating avatar for ${args.animal} (${args.color})`);

    await ctx.runMutation(internal.sidekicks.setGenerationStatus, {
      sidekickId: args.sidekickId,
      generationStatus: "generating",
    });

    try {
      const avatarPrompt = buildAvatarPrompt(args.animal, args.color);
      const habitatPrompt = buildHabitatPrompt(args.animal, args.color);

      const [avatarStorageId, habitatStorageId] = await Promise.all([
        generateAndStoreRecraftImage(ctx, avatarPrompt, {
          model: "recraftv3",
          style: "Recraft V3 Raw",
          size: "1024x1024",
          negative_prompt: "No background detail, no objects or scenery, no texture besides the paper folds",
        }),
        generateAndStoreRecraftImage(ctx, habitatPrompt, {
          model: "recraftv3",
          style: "Recraft V3 Raw",
          size: "1280x1024",
          negative_prompt: "No creatures, no animals, no characters",
        }),
      ]);

      await ctx.runMutation(internal.sidekicks.storeAvatar, {
        sidekickId: args.sidekickId,
        avatarStorageId: avatarStorageId ?? undefined,
        habitatStorageId: habitatStorageId ?? undefined,
      });

      console.log(`[SidekickGen] Avatar generation complete`);
    } catch (err) {
      console.error(`[SidekickGen] Avatar generation failed:`, err instanceof Error ? err.message : String(err));
      await ctx.runMutation(internal.sidekicks.setGenerationStatus, {
        sidekickId: args.sidekickId,
        generationStatus: "failed",
      });
    }
  },
});

/**
 * Initiate sidekick avatar generation. Checks if sidekick exists, then triggers gen.
 */
export const initiateSidekickGeneration = internalAction({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const sidekick = await ctx.runQuery(internal.sidekicks.getSidekickForScholar, {
      scholarId: args.scholarId,
    });

    if (!sidekick || !sidekick.animal || !sidekick.color) {
      console.log(`[SidekickGen] No sidekick or missing animal/color for scholar ${args.scholarId}`);
      return;
    }

    if (sidekick.generationStatus === "generating") {
      console.log(`[SidekickGen] Already generating for scholar ${args.scholarId}`);
      return;
    }

    await ctx.runAction(internal.sidekickGenerator.generateSidekickAvatar, {
      sidekickId: sidekick._id,
      animal: sidekick.animal,
      color: sidekick.color,
    });
  },
});
