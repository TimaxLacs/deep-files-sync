const watch = require('watch');
const fs = require('fs');
const path = require('path');

const srcDir = '\\Users\\samsung\\Deep.project\\sync-file\\deep-files-sync\\dirPath\\a'; // replace with your source dir
const destDir = '\\Users\\samsung\\Deep.project\\sync-file\\deep-files-sync\\dirPath\\b'; // replace with your destination dir

// Watch directory
watch.watchTree(srcDir, { interval: 1 }, (f, curr, prev) => {
    // Skip if 'f' is an object which happens when watchTree finishes initial scan
    if (typeof f === "object") return;

    const ext = path.extname(f);
    const base = path.basename(f);
    
    if (ext.toLowerCase() !== '.txt') return;

    if (prev === null) {
        // f is a new file
        fs.copyFile(f, path.join(destDir, base), (err) => {
            if (err) console.error(`Error copying file: ${err}`);
            else console.log(`Copied new file ${base} to ${destDir}`);
        });
    } else if (curr.nlink === 0) {
        // f was removed
        fs.unlink(path.join(destDir, base), (err) => {
            if (err) console.error(`Error deleting file: ${err}`);
            else console.log(`Removed file ${base} from ${destDir}`);
        });
    } else {
        // f was changed
        fs.copyFile(f, path.join(destDir, base), (err) => {
            if (err) console.error(`Error copying file: ${err}`);
            else console.log(`Updated file ${base} in ${destDir}`);
        });
    }
});