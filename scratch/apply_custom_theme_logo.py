import numpy as np
from PIL import Image

src_path = r"C:\Users\W2634\.gemini\antigravity-ide\brain\d008639f-daff-4f83-afa9-e58fba6a30e0\.user_uploaded\media_1788233359919.png"
orig = Image.open(src_path).convert("RGBA")
w, h = orig.size
print(f"Original size: {w}x{h}")

# Find bounding box of the non-white content
orig_arr = np.array(orig).astype(float)
r, g, b = orig_arr[:, :, 0], orig_arr[:, :, 1], orig_arr[:, :, 2]
is_not_bg = ~((r > 235) & (g > 235) & (b > 235))

y_indices, x_indices = np.where(is_not_bg)
if len(y_indices) > 0 and len(x_indices) > 0:
    min_x, max_x = max(0, x_indices.min() - 10), min(w, x_indices.max() + 10)
    min_y, max_y = max(0, y_indices.min() - 10), min(h, y_indices.max() + 10)
    bbox_img = orig.crop((min_x, min_y, max_x, max_y))
else:
    bbox_img = orig

bw, bh = bbox_img.size
print(f"Content bbox: {bw}x{bh}")

# Create a clean square canvas of 1024x1024 with pure white background
canvas_size = 1024
canvas = Image.new("RGBA", (canvas_size, canvas_size), (255, 255, 255, 255))

# Scale bbox_img so it fits within 82% of the canvas (safe zone)
target_size = int(canvas_size * 0.82)
scale = min(target_size / bw, target_size / bh)
new_bw = int(bw * scale)
new_bh = int(bh * scale)

scaled_img = bbox_img.resize((new_bw, new_bh), Image.Resampling.LANCZOS)

# Center it
offset_x = (canvas_size - new_bw) // 2
offset_y = (canvas_size - new_bh) // 2
canvas.paste(scaled_img, (offset_x, offset_y))

# Convert to numpy array to recolor to app theme colors
arr = np.array(canvas).astype(float)
r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]

# Identify regions:
is_bg = (r > 225) & (g > 225) & (b > 225)
is_left = (b > r * 0.9) & (b > g * 1.1) & (~is_bg) & (r < 180)
is_right = (r > b * 1.2) & (r > g * 1.1) & (~is_bg)
is_white_eq = (r > 240) & (g > 240) & (b > 240)

new_arr = np.copy(arr)
new_arr[is_bg] = [255, 255, 255, 255]

# Theme Colors:
# Left: Royal Electric Blue (#2563EB: 37, 99, 235)
# Right: Soft Coral Red (#EF4444: 239, 68, 68)
left_intensity = (r[is_left] + g[is_left] + b[is_left]) / (3.0 * 255.0)
new_arr[is_left, 0] = np.clip(37 * (1.15 - left_intensity * 0.3), 0, 255)
new_arr[is_left, 1] = np.clip(99 * (1.15 - left_intensity * 0.2), 0, 255)
new_arr[is_left, 2] = np.clip(235 * (1.1 - left_intensity * 0.15), 0, 255)

right_intensity = (r[is_right] + g[is_right] + b[is_right]) / (3.0 * 255.0)
new_arr[is_right, 0] = np.clip(239 * (1.1 - right_intensity * 0.15), 0, 255)
new_arr[is_right, 1] = np.clip(68 * (1.15 - right_intensity * 0.2), 0, 255)
new_arr[is_right, 2] = np.clip(68 * (1.15 - right_intensity * 0.2), 0, 255)

new_arr[is_white_eq & (~is_bg)] = [255, 255, 255, 255]

final_logo = Image.fromarray(new_arr.astype(np.uint8))
final_logo.save("scratch/theme_matched_logo.png", "PNG")
print("Perfect centered theme-matched logo created at scratch/theme_matched_logo.png!")
