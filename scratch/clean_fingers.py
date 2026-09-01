import cv2
import numpy as np
from PIL import Image, ImageDraw

src_path = r"C:\Users\W2634\.gemini\antigravity-ide\brain\d008639f-daff-4f83-afa9-e58fba6a30e0\fairshare_light_hands_1788225532644.jpg"
img = Image.open(src_path).convert("RGBA")
draw = ImageDraw.Draw(img)

# Background color sample from top-left
bg_color = img.getpixel((50, 50))  # typically (250, 250, 252, 255)

# 1. Erase extra fingers on Left Hand (top fingers pointing upward)
# Poly covering the extra upper splayed fingers on the purple hand
draw.polygon([
    (240, 240),
    (450, 230),
    (440, 370),
    (250, 390),
], fill=bg_color)

# 2. Erase extra fingers on Right Hand (bottom fingers pointing downward)
draw.polygon([
    (520, 640),
    (800, 630),
    (820, 800),
    (540, 800),
], fill=bg_color)

# 3. Erase the extra top-pointing finger on the Right Hand (coral hand top knuckle)
draw.polygon([
    (530, 150),
    (650, 150),
    (650, 280),
    (520, 280),
], fill=bg_color)

# Let's save intermediate to check
img.save("scratch/clean_hands_raw.png", "PNG")
print("Cleaned extra fingers!")
