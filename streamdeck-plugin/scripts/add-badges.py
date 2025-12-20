#!/usr/bin/env python3
"""
Add colored status badges to SecurePress key icons
"""
from PIL import Image, ImageDraw
import os

# Paths
LOGO_PATH = "../../logo.png"
OUTPUT_DIR = "../imgs"

# Badge configuration
BADGE_SIZE = 85  # Diameter of the badge (larger to match proportion)
BADGE_OUTLINE_WIDTH = 5  # White border around badge
BADGE_COLORS = {
    'idle': None,  # No badge for idle state
    'authenticating': '#FFA500',  # Orange
    'success': '#00CC00',  # Green
    'error': '#FF3333'  # Red
}

def add_badge(input_path, output_path, badge_color):
    """Add a colored circular badge to an image"""
    # Open the base image
    img = Image.open(input_path).convert('RGBA')

    # Get actual image size to calculate badge position
    width, height = img.size
    badge_x = width - BADGE_SIZE - 20  # 20px margin from right
    badge_y = height - BADGE_SIZE - 20  # 20px margin from bottom

    if badge_color:
        # Create a drawing context
        draw = ImageDraw.Draw(img)

        # Draw white outline first (larger circle)
        outline_bbox = [
            badge_x - BADGE_OUTLINE_WIDTH,
            badge_y - BADGE_OUTLINE_WIDTH,
            badge_x + BADGE_SIZE + BADGE_OUTLINE_WIDTH,
            badge_y + BADGE_SIZE + BADGE_OUTLINE_WIDTH
        ]
        draw.ellipse(outline_bbox, fill='#FFFFFF')

        # Draw the colored badge on top
        bbox = [badge_x, badge_y, badge_x + BADGE_SIZE, badge_y + BADGE_SIZE]
        draw.ellipse(bbox, fill=badge_color)

    # Save the result
    img.save(output_path, 'PNG')
    print(f"Created {os.path.basename(output_path)}")

def main():
    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("Adding status badges to key icons...")

    # Create each state icon
    for state, color in BADGE_COLORS.items():
        output_file = f"{OUTPUT_DIR}/key-{state}.png"
        add_badge(LOGO_PATH, output_file, color)

        # Also create @2x version
        output_file_2x = f"{OUTPUT_DIR}/key-{state}@2x.png"
        add_badge(LOGO_PATH, output_file_2x, color)

    print("\nAll badge icons created successfully!")

if __name__ == '__main__':
    main()
