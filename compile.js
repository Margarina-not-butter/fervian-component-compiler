/* 
This certainly can be done assyncronously but is not needed for Fervian and I'm lazy - ten
*/
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, statSync, copyFileSync } from 'fs';
import { resolve, join } from 'path';
import chalk from 'chalk';

const logPrefix = {
    warn: chalk.yellow.bold("[WARN] "),
    info: chalk.cyan.bold("[INFO] "),
    error: chalk.red.bold("[INFO] "),
    summary: chalk.magenta("[INFO/SUMMARY] ")
};

let sourceDirectory;
let includeDirectory;
let publicDirectory;
let resourcesDirectory;
let unprocessedFiles = 0;
let processedFiles = 0;
let copiedResources = 0;
let errors = 0;

function ensureDirSync(dir) {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}

/**
* Set the directories for source, resources, includes and compiled files.
* @param {string} source - Where to look for source files.
* @param {string} include - Where to look for include/template files.
* @param {string} _public - Output folder.
* @param {string} resources - Where to look for resource files (files that will not be processed).
*/
function setDirectories(source, include, _public, resources) {
    sourceDirectory = resolve(source);
    includeDirectory = resolve(include);
    publicDirectory = resolve(_public);
    resourcesDirectory = resolve(resources);
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
        console.log(logPrefix.info + `Including ${includePath}`);
        
        const fullPath = join(baseDir, includePath);        
        const args = {};
        const argsRegex = /\s*(\w+)="([^"]+)"/g;
        let matchArg;
        
        while ((matchArg = argsRegex.exec(argsStr)) !== null) {
            args[matchArg[1]] = matchArg[2];
        }
        
        if (existsSync(fullPath)) {
            // wdym anyhing but utf8?
            let includedContent = readFileSync(fullPath, 'utf8');
            includedContent = injectArguments(includedContent, args);
            return includedContent;
        } else {
            console.warn(logPrefix.warn + `Include file not found: ${fullPath}`);
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
        const items = readdirSync(src, { withFileTypes: true });
        items.forEach(item => {
            const srcPath = join(src, item.name);
            const destPath = join(dest, item.name);
            
            if (item.isDirectory()) {
                ensureDirSync(destPath);
                processHtmlFiles(srcPath, includeDirectory, destPath);
            } else if (item.isFile()) {
                let content = readFileSync(srcPath, 'utf8');
                const updatedContent = replaceIncludes(content, includeSrc);
                console.log(logPrefix.info + `Processing: ${destPath}`);
                if (!(content == updatedContent)) {
                    writeFileSync(destPath, updatedContent, 'utf8');
                    processedFiles += 1;
                } else {
                    unprocessedFiles += 1;
                }
            }
        });
    } catch(error) {
        console.error('Error processing HTML files:', error);
        errors += 1;
    }
    return true;
}

// NO chaneges
function copyResources(src, dest) {
    const items = readdirSync(src, { withFileTypes: true });
    items.forEach(item => {
        const srcPath = join(src, item.name);
        const destPath = join(dest, item.name);
        
        if (statSync(srcPath).isDirectory()) {
            copyResources(srcPath, destPath);
        } else {
            if (!existsSync(dest)) {
                mkdirSync(dest);
            }
            copyFileSync(srcPath, destPath);
            console.log(logPrefix.info + `Copied resource: ${item.name} ${chalk.red.bold("-->")} ${dest}`);

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
    console.log(logPrefix.summary + `${copiedResources} files were copied.`);
    console.log(logPrefix.summary + `${processedFiles} files were changed.`);
    if (unprocessedFiles > 0) console.log(logPrefix.summary + `${unprocessedFiles} files were not changed, consider moving those files to the resources directory!`);
    if (errors > 0) console.log(logPrefix.summary + `${errors} errors!`);
}

export default { setDirectories, autoRun, processHtmlFiles, injectArguments, replaceIncludes, logPrefix}