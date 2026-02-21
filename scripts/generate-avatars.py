"""
Generate profile avatars for default Rabbithole users using Gemini 2.5 Flash Image.
Outputs to public/avatars/
"""

import os
import sys

if not os.environ.get("GOOGLE_API_KEY") and not os.environ.get("GEMINI_API_KEY"):
    sys.exit("Error: Set GOOGLE_API_KEY or GEMINI_API_KEY environment variable")
if os.environ.get("GEMINI_API_KEY") and not os.environ.get("GOOGLE_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]

from google import genai
from google.genai import types

client = genai.Client()

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "avatars")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Each user: (filename, prompt)
users = [
    (
        "teacher.png",
        "Professional headshot portrait of a friendly female teacher in her 30s, mixed Hawaiian and white heritage, warm smile, wearing a casual blouse, soft natural lighting, clean neutral background, school portrait style, high quality, photorealistic"
    ),
    (
        "koa-medeiros.png",
        "School portrait photo of a 5-year-old boy, Hawaiian-Portuguese heritage, brown skin, dark curly hair, big cheerful grin, wearing a polo shirt, soft natural lighting, clean light blue background, elementary school portrait style, photorealistic"
    ),
    (
        "lily-murphy.png",
        "School portrait photo of a 6-year-old white girl with red-auburn hair in a ponytail, light freckles, bright blue eyes, sweet smile, wearing a simple blouse, soft natural lighting, clean light blue background, elementary school portrait style, photorealistic"
    ),
    (
        "lani-kealoha.png",
        "School portrait photo of a 7-year-old Hawaiian girl, brown skin, long dark wavy hair, bright confident smile, wearing a floral top, soft natural lighting, clean light blue background, elementary school portrait style, photorealistic"
    ),
    (
        "kai-nakamura.png",
        "School portrait photo of an 8-year-old Japanese boy, short black hair, curious thoughtful expression with slight smile, wearing a collared shirt, soft natural lighting, clean light blue background, elementary school portrait style, photorealistic"
    ),
    (
        "sophie-anderson.png",
        "School portrait photo of a 9-year-old white girl with straight blonde hair past her shoulders, green eyes, friendly confident smile, wearing a casual t-shirt, soft natural lighting, clean light blue background, elementary school portrait style, photorealistic"
    ),
    (
        "noah-takahashi.png",
        "School portrait photo of a 10-year-old Japanese boy, short neat black hair, confident relaxed smile, wearing a button-up shirt, soft natural lighting, clean light blue background, elementary school portrait style, photorealistic"
    ),
    (
        "jack-davis.png",
        "School portrait photo of a 10-year-old white boy with sandy brown hair, hazel eyes, relaxed grin, wearing a polo shirt, soft natural lighting, clean light blue background, elementary school portrait style, photorealistic"
    ),
]

for filename, prompt in users:
    filepath = os.path.join(OUTPUT_DIR, filename)
    if os.path.exists(filepath):
        print(f"  Skipping {filename} (already exists)")
        continue

    print(f"  Generating {filename}...")
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_modalities=["image", "text"],
            ),
        )
        for part in response.candidates[0].content.parts:
            if part.inline_data is not None:
                image = part.as_image()
                image.save(filepath)
                print(f"  Saved {filename}")
                break
        else:
            print(f"  WARNING: No image returned for {filename}")
    except Exception as e:
        print(f"  ERROR generating {filename}: {e}")

print("\nDone!")
