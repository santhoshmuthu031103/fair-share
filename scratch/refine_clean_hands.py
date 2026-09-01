from PIL import Image, ImageDraw, ImageFilter

src_path = r"C:\Users\W2634\.gemini\antigravity-ide\brain\d008639f-daff-4f83-afa9-e58fba6a30e0\fairshare_light_hands_1788225532644.jpg"
img = Image.open(src_path).convert("RGBA")

# Create a clean white background canvas
bg_color = (255, 255, 255, 255)
clean_canvas = Image.new("RGBA", img.size, bg_color)
clean_canvas.paste(img, (0, 0))

draw = ImageDraw.Draw(clean_canvas)

# Left hand (Purple) - erase top 3 extra fingers, leaving the smooth grasping thumb/finger
draw.polygon([
    (240, 220),
    (460, 220),
    (460, 360),
    (380, 380),
    (260, 370),
    (240, 300)
], fill=bg_color)

# Smooth left hand top edge
draw.ellipse([240, 340, 480, 410], fill=(79, 70, 229, 255)) # smooth wrist curve
# Re-erase any overshoot
draw.polygon([(240, 200), (460, 200), (460, 345), (240, 345)], fill=bg_color)

# Right hand (Coral) - erase bottom 3 extra fingers pointing down
draw.polygon([
    (520, 620),
    (820, 620),
    (820, 820),
    (520, 820)
], fill=bg_color)

# Right hand (Coral) - erase top extra upward finger/spur
draw.polygon([
    (500, 100),
    (680, 100),
    (680, 280),
    (500, 280)
], fill=bg_color)

# Smooth right hand top edge
draw.ellipse([500, 260, 760, 340], fill=(244, 114, 94, 255))
draw.polygon([(500, 100), (760, 100), (760, 275), (500, 275)], fill=bg_color)

# Save cleaned high-res icon
clean_canvas.save("scratch/cleaned_hands_final.png", "PNG")
print("Cleaned hands final saved!")
