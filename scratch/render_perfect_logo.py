import math
from PIL import Image, ImageDraw

def create_perfect_logo(size=1024):
    # Create pure high-res canvas with light background
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    draw = ImageDraw.Draw(canvas)

    center_x = size // 2
    center_y = size // 2
    coin_r = int(size * 0.22)  # radius of the coin

    # Colors
    color_bg = (255, 255, 255, 255)
    color_left = (79, 70, 229, 255)    # Royal Indigo (#4f46e5)
    color_right = (244, 63, 94, 255)   # Sunset Coral (#f43f5e)
    color_white = (255, 255, 255, 255)
    gap = int(size * 0.015)

    # 1. Draw Left Coin Half (Indigo)
    draw.pieslice(
        [center_x - coin_r - gap, center_y - coin_r, center_x + coin_r - gap, center_y + coin_r],
        start=90, end=270, fill=color_left
    )

    # 2. Draw Right Coin Half (Coral)
    draw.pieslice(
        [center_x - coin_r + gap, center_y - coin_r, center_x + coin_r + gap, center_y + coin_r],
        start=270, end=90, fill=color_right
    )

    # 3. Draw Stylized Left Hand grasping Left Half
    # Thumb on top grasping coin, Fingers below holding coin, Wrist to the left
    # Thumb
    thumb_w = int(size * 0.055)
    draw.ellipse(
        [center_x - int(coin_r * 0.95) - gap, center_y - coin_r - int(thumb_w * 0.6),
         center_x - int(coin_r * 0.2) - gap, center_y - coin_r + int(thumb_w * 0.8)],
        fill=color_left
    )
    # Bottom Fingers
    draw.ellipse(
        [center_x - int(coin_r * 0.95) - gap, center_y + coin_r - int(thumb_w * 0.8),
         center_x - int(coin_r * 0.2) - gap, center_y + coin_r + int(thumb_w * 0.6)],
        fill=color_left
    )
    # Left Palm / Arm
    arm_left = int(size * 0.12)
    arm_top = center_y - int(size * 0.18)
    arm_bot = center_y + int(size * 0.18)
    draw.rounded_rectangle(
        [arm_left, arm_top, center_x - int(coin_r * 0.6) - gap, arm_bot],
        radius=int(size * 0.08), fill=color_left
    )

    # 4. Draw Perfectly Mirrored Right Hand grasping Right Half
    # Thumb on top grasping coin
    draw.ellipse(
        [center_x + int(coin_r * 0.2) + gap, center_y - coin_r - int(thumb_w * 0.6),
         center_x + int(coin_r * 0.95) + gap, center_y - coin_r + int(thumb_w * 0.8)],
        fill=color_right
    )
    # Bottom Fingers
    draw.ellipse(
        [center_x + int(coin_r * 0.2) + gap, center_y + coin_r - int(thumb_w * 0.8),
         center_x + int(coin_r * 0.95) + gap, center_y + coin_r + int(thumb_w * 0.6)],
        fill=color_right
    )
    # Right Palm / Arm
    arm_right = size - int(size * 0.12)
    draw.rounded_rectangle(
        [center_x + int(coin_r * 0.6) + gap, arm_top, arm_right, arm_bot],
        radius=int(size * 0.08), fill=color_right
    )

    # 5. Draw Clean Equal Sign in the Center of the Coin
    eq_w = int(size * 0.12)
    eq_h = int(size * 0.024)
    eq_spacing = int(size * 0.02)
    
    # Top bar
    draw.rounded_rectangle(
        [center_x - eq_w // 2, center_y - eq_spacing - eq_h, center_x + eq_w // 2, center_y - eq_spacing],
        radius=eq_h // 2, fill=color_white
    )
    # Bottom bar
    draw.rounded_rectangle(
        [center_x - eq_w // 2, center_y + eq_spacing, center_x + eq_w // 2, center_y + eq_spacing + eq_h],
        radius=eq_h // 2, fill=color_white
    )

    return canvas

if __name__ == "__main__":
    logo = create_perfect_logo(1024)
    logo.save("scratch/perfect_logo.png", "PNG")
    print("Perfect symmetrical logo generated!")
