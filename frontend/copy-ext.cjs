const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..', 'extension');
const destDir = path.resolve(__dirname, '..', 'extension', 'dist');

console.log('srcDir:', fs.existsSync(srcDir), srcDir);
console.log('destDir:', fs.existsSync(destDir), destDir);

if (!fs.existsSync(srcDir)) {
    console.error('Source directory not found!');
    process.exit(1);
}

const files = ['manifest.json', 'content.js', 'background.js'];
files.forEach(f => {
    const src = path.join(srcDir, f);
    console.log('Copying:', src);
    fs.copyFileSync(src, path.join(destDir, f));
});

const iconsDir = path.join(srcDir, 'icons');
if (fs.existsSync(iconsDir)) {
    fs.cpSync(iconsDir, path.join(destDir, 'icons'), { recursive: true });
}

console.log('Extension files copied');