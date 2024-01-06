const watch = require('watch');
const fs = require('fs');
const path = require('path');

let inodeMap = {};

let dirPath = '\\Users\\samsung\\Deep.project\\sync-file\\deep-files-sync\\dirPath\\'; // Your directory path

let pendingRenames = {};

// Handle events
function handleFileChange(f, curr, prev) {
  let file = path.basename(f);

  if (prev === null) {
      // file added
      if (pendingRenames[curr.ino]) {
          console.log(`File ${pendingRenames[curr.ino]} renamed to ${file}`);
          delete pendingRenames[curr.ino];
      } 
      else {
          console.log(`File ${file} added`);
      }
  } else if (curr.nlink === 0) {
      // file removed
      if (inodeMap[prev.ino]) {
          // wait a moment to see if this inode comes back (rename)
          pendingRenames[prev.ino] = inodeMap[prev.ino];
          delete inodeMap[prev.ino];
          setTimeout(() => {
              if (pendingRenames[prev.ino]) {
                  console.log(`File ${pendingRenames[prev.ino]} removed`);
                  delete pendingRenames[prev.ino];
              }
          }, 100);
      }
  } else {
      // file changed
      console.log(`File ${file} changed`);
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
watch.watchTree(dirPath, (f, curr, prev) => {
  console.log(f, curr, prev);
  if (typeof f === "object" && prev === null && curr === null) {
      // Initial scanning complete
  } else {
      handleFileChange(f, curr, prev);
  }
});