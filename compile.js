/* 
    This certainly can be done assyncronously but is not needed for Fervian and I'm lazy - ten
*/

const fs = require('fs');
const path = require('path');

// User: touch here and nowhere else.
const sourceDirectory = path.join(__dirname, 'web-src');
const includeDirectory = path.join(__dirname, 'include');
const publicDirectory = path.join(__dirname, 'public');
const resourcesDirectory = path.join(__dirname, 'res');

function ensureDirSync(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Injects the arguments.
 * @param {string} content - Content were the arguments will be injected.
 * @param {Array} args - Arguments to be replaced.
 * @returns {string} The content with injected arguments.
 */
function injectArguments(content, args) {
    // I don't know regex, this was made by ChatGPT
    // Nevermind ChatGPT is dumb I had to change stuff
    const matches = [...content.matchAll(/<!--\s*#arg\s+"(.+?)"\s+"(.*?)"\s*-->/g)];
    matches.forEach(match => {
        const argument = match[1];
        const defaultReplace = match[2];
        const replacement = args[argument] || defaultReplace;
        content = content.replace(match[0], replacement);
    })
    return content;
}

/**
 * Loads the includes in the specified file.
 * @param {string} content - Content were the includes will be loaded.
 * @param {string} baseDir - Where to look for template files.
 * @returns {string} The content with includes replaced.
 */
function replaceIncludes(content, baseDir) {
    const includeRegex = /<!--\s*#include\s+file="(.+?)"\s*(.*?)\s*-->/g;
    return content.replace(includeRegex, (match, includePath, argsStr) => {
        console.log(`Found include directive: ${match}`);

        const fullPath = path.join(baseDir, includePath);
        console.log(`Attempting to include file from: ${fullPath}`);
        
        const args = {};
        const argsRegex = /\s*(\w+)="([^"]+)"/g;
        let matchArg;

        while ((matchArg = argsRegex.exec(argsStr)) !== null) {
            args[matchArg[1]] = matchArg[2];
        }
        
        if (fs.existsSync(fullPath)) {
            // wdym anyhing but utf8?
            let includedContent = fs.readFileSync(fullPath, 'utf8');
            console.log(`Including content from: ${fullPath}`);
            includedContent = injectArguments(includedContent, args);
            console.log(`Included content: ${includedContent}`);
            return includedContent;
        } else {
            console.warn(`Include file not found: ${fullPath}`);
            return match;
        }
    });
}

/**
 * Loads the includes in the specified file.
 * @param {string} src - Path to look recursively for files with includes.
 * @param {string} includeSrc - Where to look for template files.
 * @param {string} dest - Output path.
 * @returns {string} The content with includes replaced.
 */
function processHtmlFiles(src, includeSrc, dest) {
    try {
        const items = fs.readdirSync(src, { withFileTypes: true });
        items.forEach(item => {
            const srcPath = path.join(src, item.name);
            const destPath = path.join(dest, item.name);
            
            if (item.isDirectory()) {
                ensureDirSync(destPath);
                processHtmlFiles(srcPath, includeDirectory, destPath);
            } else if (item.isFile() && path.extname(item.name) === '.html') {
                console.log(`Processing HTML file: ${srcPath}`);
                let content = fs.readFileSync(srcPath, 'utf8');
                const updatedContent = replaceIncludes(content, includeSrc);
    
                console.log(`Replacing content in: ${destPath}`);
                fs.writeFileSync(destPath, updatedContent, 'utf8');
            }
        });
    } catch {

    }
    return true;
}

// NO chaneges
function copyResources(src, dest) {
    const items = fs.readdirSync(src, { withFileTypes: true });
    items.forEach(item => {
        const srcPath = path.join(src, item.name);
        const destPath = path.join(dest, item.name);
        
        if (fs.statSync(srcPath).isDirectory()) {
            copyResources(srcPath, destPath);
        } else {
            if (!fs.existsSync(dest)) {
                fs.mkdirSync(dest);
            }
            fs.copyFileSync(srcPath, destPath);
            console.log(`Copied resource: ${srcPath} → ${destPath}`);
        }
    });
}

/**
 * Compiles everything inside sourceDirectory to publicDirectory, using includes from includeDirectory and copying everything from resourcesDirectory to publicDirectory.
 */
function autoRun() {    
    ensureDirSync(publicDirectory);
    ensureDirSync(resourcesDirectory);
    copyResources(resourcesDirectory, publicDirectory);
    processHtmlFiles(sourceDirectory, includeDirectory, publicDirectory);    
}

module.exports = { autoRun, processHtmlFiles, injectArguments, replaceIncludes, sourceDirectory, publicDirectory, includeDirectory, resourcesDirectory}