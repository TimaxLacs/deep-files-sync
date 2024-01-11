import { DeepClient, parseJwt } from "@deep-foundation/deeplinks/imports/client.js";
import { generateApolloClient } from "@deep-foundation/hasura/client.js";
import { createRequire } from "module";
import { generateMutation, generateSerial, deleteMutation } from '@deep-foundation/deeplinks/imports/gql/index.js';

import _ from 'lodash';
let deepClient = {};
const require = createRequire(import.meta.url);
const watch = require('watch');
const fs = require('fs');
const path = require('path');
let files = {};
let containTypeId;
let syncTextFile;

const GQL_URN = process.env.GQL_URN || '3006-deepfoundation-dev-g1tf98z5qdl.ws-eu107.gitpod.io/gql';
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
    //console.log(deepClient);
    return deepClient
  }


// Сохраняем ссылки на все добавленные файлы и их связи
let addedFiles = {};

async function addedTextLinks(fileData, deep){
    const syncTextFileTypeId = await deep.id('@deep-foundation/core', 'SyncTextFile');
    const syncTextFile = (await deep.insert({
    type_id: syncTextFileTypeId,
    }, { name: 'INSERT_HANDLER_SYNC_TEXT_FILE' })).data[0];
    const syncTextFileValue = (await deep.insert({ link_id: syncTextFile?.id, value: fileData }, { table: 'strings' })).data[0];
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
    return containTypeId;
}

async function deleteLinks(ino, deep){
    const fileData = addedFiles[ino];
    if (fileData) {
        const {containTypeId, syncTextFile} = fileData;
        console.log(syncTextFile, syncTextFile.id)
        await deep.delete({
            _or: [
              {
                id: syncTextFile.id,   
              },
              {
                type_id: containTypeId,
                to_id: syncTextFile.id
              }
            ]
          });
        delete addedFiles[ino];
    }
} 

async function updateLinkValue(ino, value, deep){
    const fileData = addedFiles[ino];
    if (fileData) {
        const {syncTextFile} = fileData;
        await deep.update(
            {
              link_id: syncTextFile.id
            },
            {
              value: value
            },
            {
              table: `strings`
            }
          )      
    }
}

async function updateLinkName(ino, name, deep){
    const fileData = addedFiles[ino];
    if (fileData) {
        const {containTypeId, syncTextFile} = fileData;
        console.log(containTypeId+1)
        await deep.update(
            {
              link_id: containTypeId+1
            },
            {
              value: name
            },
            {
              table: `strings`
            }
          )  
    }
} 

async function handleFileChange(absoluteFilePath, current, previous) {
    let currentFileName = path.basename(absoluteFilePath);
    // if file added
    if (previous === null) {
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
                updateLinkName(current.ino, currentFileName, deepClient);
            }
            else {
                const fileData = fs.readFileSync(absoluteFilePath, { encoding: 'utf8' });
                files[absoluteFilePath] = fileData;

                const syncTextFile = await addedTextLinks(fileData, deepClient);
                const containTypeId = await addedContainLinks(spaceIdArgument, syncTextFile, deepClient);
                addedFiles[current.ino] = {syncTextFile, containTypeId};
                console.log(`File ${currentFileName} added`);
                console.log(JSON.stringify(files, null, 2));
            }
        }
    } else if (current.nlink === 0) {
        // file removed
        pendingRenames[previous.ino] = absoluteFilePath;
        setTimeout(() => {
            if (pendingRenames[previous.ino]) {
                delete pendingRenames[previous.ino];
                delete files[absoluteFilePath];

                deleteLinks(previous.ino, deepClient);
                console.log(`File ${currentFileName} removed`);
                console.log(JSON.stringify(files, null, 2));
            }
        }, 100);
    } else {
        // file changed
        if (files[absoluteFilePath] !== undefined) {
            const fileData = fs.readFileSync(absoluteFilePath, { encoding: 'utf8' });
            files[absoluteFilePath] = fileData;
            updateLinkValue(current.ino, files[absoluteFilePath], deepClient);
            console.log(`File ${currentFileName} changed`);
            console.log(JSON.stringify(files, null, 2));
        }
    }
}



watch.watchTree(dirPath, { interval: 1 }, async (f, curr, prev) => {
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
        await handleFileChange(f, curr, prev);
    }
});