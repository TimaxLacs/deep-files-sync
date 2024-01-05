const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

let textFiles = {};
const dirPath = '\\Users\\samsung\\Deep.project\\sync-file\\deep-files-sync\\dirPath\\';

// Initial load
fs.readdir(dirPath, (err, files) => {
    if (err) {
        console.error(`Error reading directory: ${err}`);
        return;
    }

    // Filter for '.txt' files
    files = files.filter(file => path.extname(file).toLowerCase() === '.txt');

    files.forEach(file => {
        fs.readFile(path.join(dirPath, file), 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading file: ${err}`);
                return;
            }
            // add each file content to textFiles object
            textFiles[file] = data;
            console.log(textFiles);
        });
    });
});

// File watcher
const watcher = chokidar.watch(dirPath);

// track the state of pending changes
let pendingChanges = {};

// on file added
watcher.on('add', (filePath) => {
    if(path.extname(filePath).toLowerCase() === '.txt') {
        const file = path.basename(filePath);
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading file: ${err}`);
                return;
            }

            // add new file to textFiles object
            textFiles[file] = data;
            console.log(`Added ${file}`);
            console.log(textFiles);
        });
    }
});

// on file removed
watcher.on('unlink', (filePath) => {
    const file = path.basename(filePath);
    // remove file from textFiles object
    delete textFiles[file];
    console.log(`Deleted ${file}`);
    console.log(textFiles);
});

watcher.on('change', (filePath) => {
    if(!pendingChanges[filePath]) {
        pendingChanges[filePath] = setTimeout(() => {
            if(path.extname(filePath).toLowerCase() === '.txt') {
                const file = path.basename(filePath);
                fs.readFile(filePath, 'utf8', (err, data) => {
                    if (err) {
                        console.error(`Error reading file: ${err}`);
                        return;
                    }

                    // update file content in textFiles object
                    textFiles[file] = data;
                    console.log(`Updated content of ${file}`);
                    console.log(textFiles);
                });
            }

            // clear the timeout
            delete pendingChanges[filePath];
        }, 100);  // 100ms delay to handle rename case
    }
});