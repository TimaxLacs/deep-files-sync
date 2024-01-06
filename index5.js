const watch = require('watch');
const fs = require('fs');
const path = require('path');
let files = {};
let inodeMap = {};

let dirPath = '\\Users\\samsung\\Deep.project\\sync-file\\deep-files-sync\\dirPath\\'; // Your directory path

let pendingRenames = {};

// Handle events
function handleFileChange(absoluteFilePath, current, previous) {
    let currentFileName = path.basename(absoluteFilePath);
    // if file added
    if (previous === null) {
        //проверка наличия файла по его абсолютному пути
        if (files[absoluteFilePath] === undefined) {
            // проверка идентификатора
            if (pendingRenames[current.ino]) {

                const previousAbsoluteFilePath = pendingRenames[current.ino];
                const previousFileName = path.basename(previousAbsoluteFilePath);
                const fileData = files[previousAbsoluteFilePath];

                delete files[previousAbsoluteFilePath];
                files[absoluteFilePath] = fileData;
                delete pendingRenames[current.ino];

                console.log(`File ${previousFileName} renamed to ${currentFileName}`);
                console.log(JSON.stringify(files, null, 2));
            }
            else {
                const fileData = fs.readFileSync(absoluteFilePath, { encoding: 'utf8' });
                files[absoluteFilePath] = fileData;

                console.log(`File ${currentFileName} added`);
                console.log(JSON.stringify(files, null, 2));
            }
        }


    } else if (current.nlink === 0) {
        // file removed
        //if (inodeMap[prev.ino]) {
        // wait a moment to see if this inode comes back (rename)
        pendingRenames[previous.ino] = absoluteFilePath;
        //delete inodeMap[prev.ino];
        setTimeout(() => {
            if (pendingRenames[previous.ino]) {
                delete pendingRenames[previous.ino];
                delete files[absoluteFilePath];

                console.log(`File ${currentFileName} removed`);
                console.log(JSON.stringify(files, null, 2));
            }
        }, 100);
        // }
    } else {
        // file changed
        const fileData = fs.readFileSync(absoluteFilePath, { encoding: 'utf8' });
        files[absoluteFilePath] = fileData;

        console.log(`File ${currentFileName} changed`);
        console.log(JSON.stringify(files, null, 2));
    }
}

// Initial load
fs.readdir(dirPath, (err, files) => {
    if (err) {
        console.error(`Error reading directory: ${err}`);
        return;
    }
    files.forEach(file => {
        fs.stat(path.join(dirPath, file), (err, stats) => {
            if (err) {
                console.error(`Error stating file: ${err}`);
            } else {
                inodeMap[stats.ino] = file;
            }
        });
    });
});

// Monitor the directory
watch.watchTree(dirPath, { interval: 1 }, (f, curr, prev) => {
    //console.log(f, curr, prev);
    if (typeof f === "object") {
        // Initial scanning complete
    } else {
        handleFileChange(f, curr, prev);
    }
});