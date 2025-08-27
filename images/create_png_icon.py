#!/usr/bin/env python3
"""
SVG to PNG converter for VS Code extension icon
Creates a 128x128 PNG icon from SVG content
"""

import base64
from PIL import Image, ImageDraw
import io

def create_qoder_icon():
    """Create Qoder extension icon as PNG"""
    size = 128
    
    # Create new image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Colors
    bg_color = (102, 126, 234)      # #667EEA
    accent_color = (118, 75, 162)   # #764BA2
    icon_color = (255, 255, 255)    # White
    
    # Create gradient-like effect with circle
    center = size // 2
    radius = 60
    
    # Draw main circle with gradient effect
    for i in range(radius, 0, -2):
        # Interpolate between colors
        t = (radius - i) / radius
        r = int(bg_color[0] * (1-t) + accent_color[0] * t)
        g = int(bg_color[1] * (1-t) + accent_color[1] * t)
        b = int(bg_color[2] * (1-t) + accent_color[2] * t)
        alpha = int(255 * (0.8 + 0.2 * t))
        
        draw.ellipse(
            [center-i, center-i, center+i, center+i],
            fill=(r, g, b, alpha)
        )
    
    # Draw outer ring
    draw.ellipse([center-radius, center-radius, center+radius, center+radius], 
                outline=(79, 70, 229), width=2)
    
    # Draw concentric circles (target/quest symbol)
    draw.ellipse([center-25, center-25, center+25, center+25], 
                outline=icon_color, width=3)
    draw.ellipse([center-15, center-15, center+15, center+15], 
                outline=icon_color, width=2)
    draw.ellipse([center-5, center-5, center+5, center+5], 
                fill=icon_color)
    
    # Draw directional arrows (quest directions)
    arrow_length = 15
    arrow_positions = [
        # Top
        (center, center - 39, center - 11, center - 30),
        (center, center - 39, center + 11, center - 30),
        # Right
        (center + 39, center, center + 30, center - 11),
        (center + 39, center, center + 30, center + 11),
        # Bottom
        (center, center + 39, center - 11, center + 30),
        (center, center + 39, center + 11, center + 30),
        # Left
        (center - 39, center, center - 30, center - 11),
        (center - 39, center, center - 30, center + 11),
    ]
    
    for x1, y1, x2, y2 in arrow_positions:
        draw.line([x1, y1, x2, y2], fill=icon_color, width=2)
    
    # Draw corner dots (neural network connections)
    dot_positions = [(25, 25), (103, 25), (25, 103), (103, 103)]
    for x, y in dot_positions:
        draw.ellipse([x-3, y-3, x+3, y+3], fill=icon_color)
    
    # Draw "Q" text
    try:
        # Use default font for the Q
        bbox = draw.textbbox((0, 0), "Q", anchor='mm')
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        text_x = center - text_width // 2
        text_y = center + 5  # Slightly below center
        
        draw.text((center, center + 8), "Q", fill=icon_color, anchor='mm')
    except:
        # If text fails, just continue without it
        pass
    
    return img

def main():
    """Create and save the PNG icon"""
    icon = create_qoder_icon()
    icon.save('/Users/dd/qoder-vscode-extension/images/icon.png', 'PNG')
    print("✅ Created icon.png")

if __name__ == "__main__":
    main()