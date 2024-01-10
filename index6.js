#!/usr/bin/env node
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

const GQL_URN = process.env.GQL_URN || '3006-deepfoundation-dev-5jg1c0gew5g.ws-eu107.gitpod.io/gql';
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


  async function addedTextLinks(fileData, deep){
    const syncTextFileTypeId = await deep.id('@deep-foundation/core', 'SyncTextFile');
    const syncTextFile = (await deep.insert({
    type_id: syncTextFileTypeId,
    }, { name: 'INSERT_HANDLER_SYNC_TEXT_FILE' })).data[0];
    const syncTextFileValue = (await deep.insert({ link_id: syncTextFile?.id, value: fileData }, { table: 'strings' })).data[0];
    //console.log(fileData);
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
    //console.log(spaceIdArgument);
    return containTypeId;
}

async function deleteLinks(containTypeId, syncTextFile, deep){
    const syncTextFileId = syncTextFile.id;
    console.log(containTypeId, syncTextFileId);
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
  } 

async function updateLinkValue(syncTextFile, value, deep){
    await deep.update(
        {
          link_id: syncTextFile
        },
        {
          value: value
        },
        {
          table: (typeof value) + 's'
        }
      )      
}

/*
async function deleteLink(currentFileName){
    //console.log(currentFileName);
    return await deleteMutation('links', {
        where: {
        currentFileName: {
            _eq: currentFileName
        }
        }
    }, {
        returning: 'id, currentFileName'
    });
}
  */

// Handle events
async function handleFileChange(absoluteFilePath, current, previous) {
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

                syncTextFile = await addedTextLinks(fileData, deepClient);
                containTypeId = await addedContainLinks(spaceIdArgument, syncTextFile, deepClient);

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

                deleteLinks(containTypeId, syncTextFile, deepClient);
                //console.log(`File ${currentFileName} removed`);
                //console.log(JSON.stringify(files, null, 2));
            }
        }, 100);
        // }
    } else {
        // file changed
        const fileData = fs.readFileSync(absoluteFilePath, { encoding: 'utf8' });
        files[absoluteFilePath] = fileData;
        updateLinkValue(syncTextFile, files[absoluteFilePath], deepClient);
        console.log(`File ${currentFileName} changed`);
        console.log(JSON.stringify(files, null, 2));
    }
}

// Monitor the directory
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


