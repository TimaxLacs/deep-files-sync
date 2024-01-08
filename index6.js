#!/usr/bin/env node
import { DeepClient, parseJwt } from "@deep-foundation/deeplinks/imports/client.js";
import { generateApolloClient } from "@deep-foundation/hasura/client.js";
import { createRequire } from "module";
import _ from 'lodash';

let deepClient = {};
const require = createRequire(import.meta.url);
const watch = require('watch');
const fs = require('fs');
const path = require('path');
let files = {};

const GQL_URN = process.env.GQL_URN || 'https://3007-deepfoundation-dev-pfn7c1crkga.ws-eu107.gitpod.io/?dc-dg-ins=%7B%7D&space-id=380&container=380';
const GQL_SSL = process.env.GQL_SSL || 1;

const token = process.argv[2];
let dirPath = process.argv[3];
const spaceIdArgument  = process.argv[4];

dirPath = '\\Users\\samsung\\Deep.project\\sync-file\\deep-files-sync\\dirPath\\'; // Your directory path

let pendingRenames = {};




const makeDeepClient = token => {
    if (!token) throw new Error("No token provided")
    const decoded = parseJwt(token)
    const linkId = decoded?.userId
    const apolloClient = generateApolloClient({
      path: GQL_URN,
      ssl: !!+GQL_SSL,
      token
    })
  
    const deepClient = new DeepClient({ apolloClient, linkId, token })
    console.log(deepClient);
    return deepClient
  }
  

async function addedTextLinks(fileData, deep){
    const syncTextFileTypeId = await deep.id('@deep-foundation/core', 'SyncTextFile');
    const syncTextFile = (await deep.insert({
    type_id: syncTextFileTypeId,
    }, { name: 'INSERT_HANDLER_SYNC_TEXT_FILE' })).data[0];
    console.log(syncTextFile);
    const syncTextFileValue = (await deep.insert({ link_id: syncTextFile?.id, value: fileData }, { table: 'strings' })).data[0];
    console.log(fileData);
    return syncTextFile;
}
async function addedContainLinks(spaceIdArgument, syncTextFile, deep){
    const spaceId = spaceIdArgument || (await deep.id('deep', 'admin'));
    const containTypeId = await deep.id('@deep-foundation/core', 'Contain');
    const spaceContainSyncTextFile = (await deep.insert({
    from_id: spaceId,
    type_id: containTypeId,
    to_id: syncTextFile?.id,
    }, { name: 'INSERT_SYNC_TEXT_FILE_CONTAIN' })).data[0];
    console.log(spaceIdArgument);
}

// Handle events
function handleFileChange(absoluteFilePath, current, previous) {
    let currentFileName = path.basename(absoluteFilePath);
    // if file added
    if (previous === null) {
        //проверка наличия файла по его абсолютному пути
        if (files[absoluteFilePath] === undefined) {
            // проверка идентификатора --> rename или add
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

                const syncTextFile = addedTextLinks(fileData, deepClient);
                addedContainLinks(spaceIdArgument, syncTextFile, deepClient);

                //console.log(`File ${currentFileName} added`);
                //console.log(JSON.stringify(files, null, 2));
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

// Monitor the directory
watch.watchTree(dirPath, { interval: 1 }, (f, curr, prev) => {
    //console.log(f, curr, prev);
    if (typeof f === "object") {
        // Initial scanning complete
        deepClient = makeDeepClient(token);
        const filesStats = f;
        Object.keys(filesStats).forEach(fileName => {
            if (fileName == dirPath) {
                return;
            }
            const fileData = fs.readFileSync(fileName, { encoding: 'utf8' });
            files[fileName] = fileData;
        })
        console.log(`Files initialized `);
        console.log(JSON.stringify(files, null, 2));
    } else {
        handleFileChange(f, curr, prev);
    }
});


