const watch = require('watch');
const fs = require('fs');
const path = require('path');
const async = require('async');

let textFiles = {};

const dirPath = '\\Users\\samsung\\Deep.project\\sync-file\\deep-files-sync\\dirPath\\'; // Your directory path

// Function to get and save text of a .txt file
function getTextFile(filePath, callback) {
    const file = path.basename(filePath);

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return callback(err);
        }

        textFiles[file] = data;
        callback();
        console.log(textFiles);
    });
}

// Initial load
fs.readdir(dirPath, (err, files) => {
    if (err) {
        return console.error(`Error reading directory: ${err}`);
    }

    files = files.filter(file => path.extname(file).toLowerCase() === '.txt');

    async.each(files, (file, callback) => {
        getTextFile(path.join(dirPath, file), callback);
    }, (err) => {
        if (err) {
            console.error(`Error reading file: ${err}`);
        } else {
            console.log(textFiles);
        }
    });
});

// Watch directory
watch.watchTree(dirPath, { interval: 1 }, (f, curr, prev) => {

    if (typeof f === "object") return;
    const ext = path.extname(f);
    
    if (ext.toLowerCase() !== '.txt') return;

    if (typeof f == "object" && prev === null && curr === null) {
        // Finished walking the tree
    } else if (prev === null) {
        // f is a new file
        getTextFile(f, (err) => {
            if (err) console.error(err);
            else console.log("Added " + f);
        });
    } else if (curr.nlink === 0) {
        // f was removed
        const file = path.basename(f);
        delete textFiles[file];
        console.log("Removed " + f);
        console.log(textFiles);
    } else {
        // f was changed
        getTextFile(f, (err) => {
            if (err) console.error(err);
            else console.log("Changed " + f);
        });
    }
});