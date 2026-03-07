import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

type RecraftGenerateOptions = {
  model?: string;
  style?: string;
  size?: "1024x1024" | "1024x1365" | "1365x1024" | "1280x1024";
  artistic_level?: number;
  negative_prompt?: string;
};

type RecraftImageResponse = {
  data: Array<{ url: string }>;
};

/**
 * Generate an image using Recraft V3 API and store it in Convex storage.
 * Returns null if RECRAFT_API_KEY is not set (graceful degradation).
 */
export async function generateAndStoreRecraftImage(
  ctx: ActionCtx,
  prompt: string,
  options: RecraftGenerateOptions = {},
): Promise<Id<"_storage"> | null> {
  const apiKey = process.env.RECRAFT_API_KEY;
  if (!apiKey) {
    console.warn("[recraft] RECRAFT_API_KEY not set — skipping image generation");
    return null;
  }

  const requestBody: Record<string, unknown> = {
    prompt,
    model: options.model ?? "recraftv3",
    style: options.style ?? "Recraft V3 Raw",
    size: options.size ?? "1024x1024",
    artistic_level: options.artistic_level ?? 1,
    n: 1,
    response_format: "url",
  };
  if (options.negative_prompt) {
    requestBody.negative_prompt = options.negative_prompt;
  }

  const response = await fetch("https://external.api.recraft.ai/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Recraft generation failed (${response.status}): ${errorText}`);
  }

  const data: RecraftImageResponse = await response.json();
  const imageUrl = data.data[0]?.url;
  if (!imageUrl) {
    throw new Error(`No image URL in Recraft response: ${JSON.stringify(data)}`);
  }

  console.log("[recraft] Generated image, fetching from URL...");
  const imgResponse = await fetch(imageUrl);
  if (!imgResponse.ok) {
    throw new Error(`Failed to fetch Recraft image (${imgResponse.status})`);
  }

  const imageBlob = await imgResponse.blob();
  const storageId = await ctx.storage.store(imageBlob);
  console.log("[recraft] Stored image in Convex storage:", storageId);

  return storageId;
}
