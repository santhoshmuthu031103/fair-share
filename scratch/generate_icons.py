import os
from PIL import Image, ImageDraw

source_image_path = r"c:\Users\W2634\Documents\Antigravity\New folder\scratch\cleaned_hands_final.png"
res_dir = r"c:\Users\W2634\Documents\Antigravity\New folder\android\app\src\main\res"
public_dir = r"c:\Users\W2634\Documents\Antigravity\New folder\public"

# Load source image
img = Image.open(source_image_path).convert("RGBA")

# Mipmap densities and their standard launcher sizes (in px)
densities = {
    'mipmap-mdpi': (48, 108),
    'mipmap-hdpi': (72, 162),
    'mipmap-xhdpi': (96, 216),
    'mipmap-xxhdpi': (144, 324),
    'mipmap-xxxhdpi': (192, 432),
}

# Crop slightly to center the hands emblem
w, h = img.size
crop_box = (int(w * 0.05), int(h * 0.05), int(w * 0.95), int(h * 0.95))
cropped_img = img.crop(crop_box)

for folder, (icon_size, fg_size) in densities.items():
    target_folder = os.path.join(res_dir, folder)
    os.makedirs(target_folder, exist_ok=True)
    
    # 1. Standard ic_launcher.png (resized square)
    launcher_img = cropped_img.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    launcher_img.save(os.path.join(target_folder, "ic_launcher.png"), "PNG")
    
    # 2. Circular ic_launcher_round.png
    mask = Image.new('L', (icon_size, icon_size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, icon_size, icon_size), fill=255)
    round_img = Image.new('RGBA', (icon_size, icon_size), (255, 255, 255, 0))
    round_img.paste(launcher_img, (0, 0))
    round_img.putalpha(mask)
    round_img.save(os.path.join(target_folder, "ic_launcher_round.png"), "PNG")
    
    # 3. Adaptive foreground (108dp canvas with safe zone in center)
    fg_img = Image.new('RGBA', (fg_size, fg_size), (255, 255, 255, 0))
    inner_size = int(fg_size * 0.72)
    inner_img = cropped_img.resize((inner_size, inner_size), Image.Resampling.LANCZOS)
    offset = (fg_size - inner_size) // 2
    fg_img.paste(inner_img, (offset, offset))
    fg_img.save(os.path.join(target_folder, "ic_launcher_foreground.png"), "PNG")
    
    # 4. Adaptive background (solid clean white)
    bg_img = Image.new('RGBA', (fg_size, fg_size), (255, 255, 255, 255))
    bg_img.save(os.path.join(target_folder, "ic_launcher_background.png"), "PNG")

# Also save to public for web/PWA/favicon
os.makedirs(public_dir, exist_ok=True)
fav_32 = cropped_img.resize((32, 32), Image.Resampling.LANCZOS)
fav_32.save(os.path.join(public_dir, "favicon.png"), "PNG")
fav_32.save(os.path.join(public_dir, "favicon.ico"), "ICO")

icon_192 = cropped_img.resize((192, 192), Image.Resampling.LANCZOS)
icon_192.save(os.path.join(public_dir, "icon-192.png"), "PNG")

icon_512 = cropped_img.resize((512, 512), Image.Resampling.LANCZOS)
icon_512.save(os.path.join(public_dir, "icon-512.png"), "PNG")
icon_512.save(os.path.join(public_dir, "app-logo.png"), "PNG")

print("All Android & Web launcher icons re-generated with cleaned hands logo!")
