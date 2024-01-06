const fs = require('fs');

fs.watch('\\Users\\samsung\\Deep.project\\sync-file\\deep-files-sync\\dirPath\\', (eventType, filename) => {
  console.log(`event type is: ${eventType}`);
  if (filename) {
    console.log(`filename provided: ${filename}`);
  } else {
    console.log('filename not provided');
  }
});
