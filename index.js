#!/usr/bin/env node
import { DeepClient, parseJwt } from "@deep-foundation/deeplinks/imports/client.js";
import { generateApolloClient } from "@deep-foundation/hasura/client.js";
import { createRequire } from "module";
import { generateMutation, generateSerial, deleteMutation } from '@deep-foundation/deeplinks/imports/gql/index.js';
import _ from 'lodash';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
let deepClient = {};
const require = createRequire(import.meta.url);
const { program } = require('commander')
const watch = require('watch');
const fs = require('fs');
const path = require('path');
let files = {};
let containTypeId;
let syncTextFile;

let pendingRenames = {};

const argv = yargs(hideBin(process.argv))
  .option('url', {
    alias: 'u',
    type: 'string',
    description: 'URL deeplinks'
  })
  .option('space-id', {
    alias: 's',
    type: 'string',
    description: 'Space ID'
  })
  .option('folder-path', {
    alias: 'f',
    type: 'string',
    description: 'Path to folder'
  })
  .option('token', {
    alias: 't',
    type: 'string',
    description: 'Token',
    default: ''
  })
  .argv;

const token = argv.token;
let dirPath = argv['folder-path'];
const spaceIdArgument  = argv['space-id'];
let urn = argv.url;
let ssl;

const url_protocol = urn.match(/^(http:|https:)/)[0];
if (url_protocol === "https:") {
  ssl = true;
} else if (url_protocol === "http:") {
  ssl = false;
} else {
  throw new Error(`Unsupported protocol: ${url.protocol}`);
}

if (!urn.endsWith("/gql")) {
  urn += "/gql";
}
urn = urn.replace(/^https:\/\//, "");
urn.replace(/^http:\/\//, "");

const GQL_URN = process.env.GQL_URN || urn
const GQL_SSL = process.env.GQL_SSL || ssl;


const makeDeepClient = token => {
    if (!token) throw new Error("No token provided")
    const decoded = parseJwt(token)
    const linkId = decoded.userId
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
    const syncTextFileValue = (await deep.insert({ link_id: syncTextFile.id, value: fileData }, { table: 'strings' })).data[0];
    //console.log(fileData);
    return syncTextFile;
}
async function addedContainLinks(spaceIdArgument, syncTextFile, deep, fileName){
    const spaceId = spaceIdArgument || (await deep.id('deep', 'admin'));
    const containTypeId = await deep.id('@deep-foundation/core', 'Contain');
    const spaceContainSyncTextFile = (await deep.insert({
    from_id: spaceId,
    type_id: containTypeId,
    string: { data: { value: fileName } },
    to_id: syncTextFile.id,
    }, { name: 'INSERT_SYNC_TEXT_FILE_CONTAIN' })).data[0];
    //console.log(spaceIdArgument, spaceContainSyncTextFile);
    return containTypeId;
}

async function deleteLinks(containTypeId, fileName, deep){
    //const syncTextFileId = syncTextFile.id;
    //console.log(containTypeId, fileName);
    const { data } = await deep.select({ 
      in: {
          type_id: containTypeId,
          string: { value: { _eq: fileName } }
      }
        });
        const syncTextFile = data[0];
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

async function updateLinkValue(valueText, deep, containTypeId, fileName){
  fileName = fileName.replace(/\.txt/g, "");
  console.log(valueText);
  const { data } = await deep.select({ 
    in: {
                type_id: containTypeId,
                string: { value: { _eq: fileName } }
    }
      });
   const syncTextFile = data[0];
   console.log(syncTextFile, valueText);
    await deep.update(
        {
          link_id: syncTextFile.id
        },
        {
          value: valueText
        },
        {
          table: (typeof valueText) + 's'
        }
      )      
}

async function updateLinkName(deep, containTypeId, fileName, newName){
  fileName = fileName.replace(/\.txt/g, "");
  const { data } = await deep.select({ 
      type_id: containTypeId,
      string: { value: { _eq: fileName } }
});
   const syncTextFile = data[0];
   console.log(containTypeId, fileName);
    await deep.update(
        {
          link_id: syncTextFile.id
        },
        {
          value: newName
        },
        {
          table: (typeof newName) + 's'
        }
      )      
}
async function handleFileChange(absoluteFilePath, current, previous) {
    let currentFileName = path.basename(absoluteFilePath);
    currentFileName = currentFileName.replace(/\.txt/g, "");
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
                updateLinkName(deepClient, 3, previousFileName, currentFileName);
                console.log(`File ${previousFileName} renamed to ${currentFileName}`);
                console.log(JSON.stringify(files, null, 2));
            }
            else {
                const fileData = fs.readFileSync(absoluteFilePath, { encoding: 'utf8' });
                files[absoluteFilePath] = fileData;
                syncTextFile = await addedTextLinks(fileData, deepClient);
                containTypeId = await addedContainLinks(spaceIdArgument, syncTextFile, deepClient, currentFileName);

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
                
                deleteLinks(3, currentFileName, deepClient);
                //console.log(`File ${currentFileName} removed`);
                //console.log(JSON.stringify(files, null, 2));
            }
        }, 100);
        // }
    } else {
        // file changed
        const fileData = fs.readFileSync(absoluteFilePath, { encoding: 'utf8' });
        files[absoluteFilePath] = fileData;
        updateLinkValue(fileData, deepClient, 3, currentFileName);
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