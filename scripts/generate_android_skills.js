const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, '../skills');
const TARGET_DIR = path.join(__dirname, '../android-skills');

const EXCLUDED_SKILLS = [
    'developing-genkit-dart',
    'developing-genkit-go',
    'developing-genkit-js',
    'developing-genkit-python',
    'xcode-project-setup'
];

const EXCLUDED_FILE_PATTERNS = [
    /ios/i,
    /web/i,
    /flutter/i
];

function deleteFolderRecursive(directoryPath) {
    if (fs.existsSync(directoryPath)) {
        fs.readdirSync(directoryPath).forEach((file, index) => {
            const curPath = path.join(directoryPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(directoryPath);
    }
}

function copyRecursive(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();

    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest);
        }
        fs.readdirSync(src).forEach((childItemName) => {
            copyRecursive(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        // Check if file should be excluded
        const basename = path.basename(src);
        const shouldExclude = EXCLUDED_FILE_PATTERNS.some(pattern => pattern.test(basename));
        
        if (!shouldExclude) {
            fs.copyFileSync(src, dest);
        }
    }
}

function cleanLinks(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    
    content = content.replace(linkRegex, (match, label, href) => {
        const shouldExclude = EXCLUDED_FILE_PATTERNS.some(pattern => pattern.test(href));
        if (shouldExclude) {
            return '';
        }
        return match;
    });
    
    // Clean up double commas, trailing commas in lists
    content = content.replace(/,\s*,/g, ',');
    content = content.replace(/,\s*or\s*,/g, ' or ');
    content = content.replace(/,\s*\]/g, ']');
    content = content.replace(/\[\s*,/g, '[');
    
    // Clean up empty list items or broken sentences
    content = content.replace(/Read\s*,/g, 'Read');
    content = content.replace(/,\s*or\s*$/gm, '');
    content = content.replace(/,\s*$/gm, '');
    content = content.replace(/^\s*-\s*\*\*.*?\*\*:\s*See\s*$/gm, '');
    content = content.replace(/^\s*-\s*\*\*.*?\*\*:\s*$/gm, '');
    content = content.replace(/^\s*[*+-]\s*\*\*(iOS|Web|Flutter)\*\*:\s*$/gmi, '');
    
    fs.writeFileSync(filePath, content, 'utf8');
}

function processFiles(dir) {
    fs.readdirSync(dir).forEach((file) => {
        const fullPath = path.join(dir, file);
        if (fs.lstatSync(fullPath).isDirectory()) {
            processFiles(fullPath);
        } else if (path.extname(fullPath) === '.md') {
            cleanLinks(fullPath);
        }
    });
}

function main() {
    console.log('Generating Android-only skills...');
    
    // Clear target dir
    deleteFolderRecursive(TARGET_DIR);
    fs.mkdirSync(TARGET_DIR, { recursive: true });
    
    // Copy skills
    fs.readdirSync(SOURCE_DIR).forEach((skill) => {
        if (EXCLUDED_SKILLS.includes(skill)) {
            console.log(`Skipping skill: ${skill}`);
            return;
        }
        
        console.log(`Copying skill: ${skill}`);
        copyRecursive(path.join(SOURCE_DIR, skill), path.join(TARGET_DIR, skill));
    });
    
    // Process files to clean links
    console.log('Cleaning links...');
    processFiles(TARGET_DIR);
    
    console.log('Done!');
}

main();
