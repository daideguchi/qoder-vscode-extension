// Icon creation script for Qoder VS Code Extension
const fs = require('fs');
const path = require('path');

// Create different sized SVG icons for VS Code
const sizes = [16, 32, 64, 128];
const baseColor = '#667EEA';
const accentColor = '#764BA2';
const iconColor = '#FFFFFF';

sizes.forEach(size => {
    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg${size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${baseColor}"/>
      <stop offset="100%" style="stop-color:${accentColor}"/>
    </linearGradient>
    <linearGradient id="icon${size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${iconColor}"/>
      <stop offset="100%" style="stop-color:#E0E7FF"/>
    </linearGradient>
  </defs>
  
  <circle cx="64" cy="64" r="60" fill="url(#bg${size})" stroke="#4F46E5" stroke-width="2"/>
  <circle cx="64" cy="64" r="25" fill="none" stroke="url(#icon${size})" stroke-width="3"/>
  <circle cx="64" cy="64" r="15" fill="none" stroke="url(#icon${size})" stroke-width="2"/>
  <circle cx="64" cy="64" r="5" fill="url(#icon${size})"/>
  
  <g stroke="url(#icon${size})" stroke-width="2" fill="none" opacity="0.7">
    <path d="M64 39 L75 30 M64 39 L53 30"/>
    <path d="M89 64 L98 53 M89 64 L98 75"/>
    <path d="M64 89 L75 98 M64 89 L53 98"/>
    <path d="M39 64 L30 53 M39 64 L30 75"/>
  </g>
  
  <circle cx="25" cy="25" r="3" fill="url(#icon${size})" opacity="0.8"/>
  <circle cx="103" cy="25" r="3" fill="url(#icon${size})" opacity="0.8"/>
  <circle cx="25" cy="103" r="3" fill="url(#icon${size})" opacity="0.8"/>
  <circle cx="103" cy="103" r="3" fill="url(#icon${size})" opacity="0.8"/>
  
  <text x="64" y="72" text-anchor="middle" fill="url(#icon${size})" font-family="Arial, sans-serif" font-size="16" font-weight="bold">Q</text>
</svg>`;
    
    fs.writeFileSync(`./images/icon-${size}.svg`, svg);
    console.log(`✅ Created icon-${size}.svg`);
});

// Create a simple README banner SVG
const bannerSvg = `<svg width="800" height="200" viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bannerBg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#667EEA"/>
      <stop offset="50%" style="stop-color:#764BA2"/>  
      <stop offset="100%" style="stop-color:#F093FB"/>
    </linearGradient>
  </defs>
  
  <rect width="800" height="200" fill="url(#bannerBg)"/>
  
  <circle cx="150" cy="100" r="50" fill="rgba(255,255,255,0.2)" stroke="white" stroke-width="2"/>
  <circle cx="150" cy="100" r="30" fill="none" stroke="white" stroke-width="2"/>
  <circle cx="150" cy="100" r="20" fill="none" stroke="white" stroke-width="1.5"/>
  <circle cx="150" cy="100" r="8" fill="white"/>
  
  <text x="250" y="80" fill="white" font-family="Arial, sans-serif" font-size="36" font-weight="bold">Qoder</text>
  <text x="250" y="110" fill="rgba(255,255,255,0.9)" font-family="Arial, sans-serif" font-size="18">AI Development Agent for VS Code</text>
  <text x="250" y="135" fill="rgba(255,255,255,0.8)" font-family="Arial, sans-serif" font-size="14">Quest-driven development • Continuous learning • dd system integration</text>
  
  <g stroke="white" stroke-width="1" fill="none" opacity="0.3">
    <path d="M650 50 L680 30 M650 50 L620 30"/>
    <path d="M720 80 L750 60 M720 80 L750 100"/>
    <path d="M650 150 L680 170 M650 150 L620 170"/>
  </g>
</svg>`;

fs.writeFileSync('./images/banner.svg', bannerSvg);
console.log('✅ Created banner.svg');

console.log('\n🎨 Icon creation completed!');
console.log('📁 Created files:');
console.log('   - icon.svg (main)');
console.log('   - icon-16.svg, icon-32.svg, icon-64.svg, icon-128.svg');
console.log('   - banner.svg (README)');