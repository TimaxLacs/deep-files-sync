import pkg from '@apollo/client/core/core.cjs';
const { ApolloClient, InMemoryCache, split, HttpLink } = pkg;
import { DeepClient, parseJwt } from "@deep-foundation/deeplinks/imports/client.js";
import { WebSocketLink } from '@apollo/client/link/ws/ws.cjs';
import { getMainDefinition } from '@apollo/client/utilities/utilities.cjs';
import { SubscriptionClient } from 'subscriptions-transport-ws';
import ws from 'ws';
import fs from 'fs';
import path from 'path';
import watch from 'watch';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwczovL2hhc3VyYS5pby9qd3QvY2xhaW1zIjp7IngtaGFzdXJhLWFsbG93ZWQtcm9sZXMiOlsiYWRtaW4iXSwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoiYWRtaW4iLCJ4LWhhc3VyYS11c2VyLWlkIjoiMzgwIn0sImlhdCI6MTcyMjYxNTU3MH0.xjNFg3-OYCh7-m134kgbl1pb7YazweBX6rGibujgxZI';
const GQL_URN = '3006-deepfoundation-dev-bu0pqanmf2m.ws-eu115.gitpod.io/gql';
const dirPath = '/home/timax/Code/Deep-project/deep-files-sync/test';

const makeDeepClient = (token) => {
    if (!token) throw new Error("Token not provided");
    try {
        const decoded = parseJwt(token);
        const linkId = decoded['x-hasura-user-id'];

        const wsClient = new SubscriptionClient(
            `wss://${GQL_URN}`,
            {
                reconnect: true,
                connectionParams: {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            },
            ws
        );

        const wsLink = new WebSocketLink(wsClient);

        const httpLink = new HttpLink({
            uri: `https://${GQL_URN}`,
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const link = split(
            ({ query }) => {
                const definition = getMainDefinition(query);
                return (
                    definition.kind === 'OperationDefinition' &&
                    definition.operation === 'subscription'
                );
            },
            wsLink,
            httpLink
        );

        const apolloClient = new ApolloClient({
            link,
            cache: new InMemoryCache(),
        });

        const deepClient = new DeepClient({ apolloClient, linkId, token });
        console.log('DeepClient created successfully');
        return deepClient;
    } catch (error) {
        console.error('Error creating DeepClient:', error);
        throw error;
    }
};

let deep;

try {
    deep = makeDeepClient(token);
} catch (error) {
    console.error('Could not create DeepClient:', error);
    process.exit(1);
}

// Функция для создания файла
const createFile = (filePath, content = '') => {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, content, { flag: 'w' });
    }
}


const createDirectory = (directoryPath) => {
   if (!fs.existsSync(directoryPath)) {
       fs.mkdirSync(directoryPath, { recursive: true });
   };

};



const getIdFromFolderName = (folderPath) => {
    const folderName = path.basename(folderPath); 
    return folderName.split('__')[0]; 
};

const generateFirstDirStruct = (arrayLink, baseDir) => {
   const idInFolder = getIdFromFolderName(baseDir);
   let linkDir;

    for (let objLink of arrayLink[0].data) {
        for (let key in objLink) {
            if (objLink[key] === idInFolder) {
                var typeRelationDir;
                switch (key) {
                    case 'id':
                        break;
                    case 'type_id':
                        typeRelationDir = 'type';
                        break;
                    case 'from_id':
                        typeRelationDir = 'out';
                        break;
                    case 'to_id':
                        typeRelationDir = 'in';
                        break;
                    default:
                        break;
                }
            } else typeRelationDir = 'links';
        }
        if(typeRelationDir){
            const relationTypeDir = path.join(baseDir, typeRelationDir);
            createDirectory(relationTypeDir);
            
            linkDir = path.join(relationTypeDir, `${objLink.id}__${objLink.type_id}`);
            createDirectory(linkDir);
        } else linkDir = baseDir

        newRec2(arrayLink[0].return, objLink, linkDir)
    }
};






const newRec1 = (returnPath) => {
   let relationName = Object.keys(returnPath)[0];
   for (let key = 0; typeof returnPath[relationName] !== 'object'; key++) {
       relationName = Object.keys(returnPath)[key];
       if (Object.keys(returnPath).length <= key) return;
   }

   if (!returnPath[relationName]['relation']) {
       returnPath = returnPath[relationName];
       let data = newRec1(returnPath);
       let relationNewName = data[0];
       let relationOldName = data[1];
       returnPath = data[2];
       return [relationNewName, relationOldName, returnPath];
   }

   let relationNewName = returnPath[relationName]['relation'];
   let relationOldName = relationName;
   return [relationNewName, relationOldName, returnPath];
};


const newRec2 = (returnPath, arrayLink, baseDir) => {
    let data = newRec1(returnPath);
    if (data === undefined) return;

    let relationNewName = data[0];
    let relationOldName = data[1]; 
    let returnNewPath = data[2];

    let newDir = path.join(baseDir, relationNewName); 
    createDirectory(newDir); 

    if(typeof arrayLink === 'object') arrayLink = arrayLink[relationOldName]

    for(let i = 0; arrayLink.length > i; i++){
      let newLinkDir = path.join(newDir, `${arrayLink[i].id}__${arrayLink[i].type_id}`); 
      createDirectory(newLinkDir); 
      
      newRec2(returnNewPath[relationOldName], arrayLink[i], newLinkDir)
   }

};





const processResult = (resultData, data, currentDir) => {

   let transformedObject = {};
   let pathList = []; 
   let relationPath;
   // Проверяем, есть ли поля return
   if (resultData[0].return !== undefined) { //если в eval есть запрос с наличием relation и return
      generateFirstDirStruct(resultData, currentDir)
      //newRec2(resultData[0].return, resultData[0].data, baseDir);
  } else { //если в eval обычный запрос типа deep.Traveler
    for(let link in resultData[0].data){
        console.log(resultData[0].data[link])
        let newLinkDir = path.join(currentDir, `${resultData[0].data[link].id}__${resultData[0].data[link].type_id}`); 
        createDirectory(newLinkDir); 
    }
       relationPath = data.match(/\.([a-zA-Z]+)\(/g) || [];
       relationPath = relationPath.map(match => match.substring(1, match.length - 1))
           .filter(key => !['item', 'return', 'Traveler', 'select'].includes(key));
   }  
   console.log(relationPath, 'relationPath')
   // Создаем объект по извлеченным связям

   return transformedObject;
};



const executeEvalFile = async (evalPath, currentDir) => {
   fs.readFile(evalPath, 'utf8', async (err, data) => {
       if (err) {
           console.error('Ошибка чтения eval.js:', err);
           createFile(path.join(currentDir, 'eval.js'));
           return;
       }

       try {
           let linkId = null;
           const parts = path.basename(currentDir).split('_');
           if (parts.length >= 3) {
               linkId = parseInt(parts[0]);
           }

           const queryFunction = new Function(
               'deep',
               'linkId',
               `
               return (async () => {
                   try {
                       const result = await (${data});
                       if (result && typeof result.subscribe === 'function') {
                        console.log()
                           const subscription = result.subscribe({
                               next: links => {
                                   const processedLinks = processResult(links, data);
                                   console.log('Новое значение из подписки:', processedLinks);
                               },
                               error: error => {
                                   console.error('Ошибка подписки:', error);
                               }
                           });
                           return { type: 'subscription', subscription };
                       } else {
                           return { type: 'query', data: Array.isArray(result) ? result : [result] };
                       }
                   } catch (err) {
                       throw new Error("Ошибка в теле eval.js: " + err.message);
                   }
               })();
               `
           );

           const executionResult = await queryFunction(deep, linkId);

           if (executionResult) {
               if (executionResult.type === 'subscription') {
                   const evalPath = path.join(currentDir, 'eval.js');
                   if (fs.existsSync(evalPath)) {
                       console.log(`Файл stop уже существует в ${currentDir}.`);
                   } else {
                       fs.watchFile(evalPath, (curr, prev) => {
                           if (fs.existsSync(evalPath)) {
                               console.log(`Файл stop появился в ${currentDir}. Отписываемся...`);
                               executionResult.subscription.unsubscribe();
                               fs.unwatchFile(evalPath);
                           }
                       });
                   }
               } else if (executionResult.type === 'query') {
                   const processedResult = processResult(executionResult.data, data, currentDir);
                   console.log(processedResult, 'transformedObject');
                   //console.log(processedResult.out[0].item, 'transformedObject');
                   createFile(path.join(currentDir, 'eval.js'));
               }
           } else {
               console.error('Получен неопределенный результат:', executionResult);
               createFile(path.join(currentDir, 'eval.js'));
           }
       } catch (error) {
           console.error('Ошибка при выполнении eval.js:', error);
           createFile(path.join(currentDir, 'eval.js'));
       }
   });
};




let evalData = {}; // Объект для хранения данных удаленных файлов



// // Настройка наблюдателя за появлением и удалением файлов
watch.watchTree(dirPath, async (f, curr, prev) => {
    if (typeof f === 'object' && prev === null && curr === null) {
      return;
    } else if (typeof f === 'string') {
      const currentDir = path.dirname(f);
      const evalPath = path.join(currentDir, 'eval.js');
  
      if (f.endsWith('eval.js')) { // Проверяем, является ли файл eval.js
        if (fs.existsSync(evalPath)) {
          // Файл существует (создание/изменение)
          try {
            const data = await fileread(evalPath, currentDir);
            evalData[evalPath] = data;
            console.log(`Файл eval.js был изменен в ${currentDir}. Данные обновлены.`);
          } catch (error) {
            console.error(`Ошибка чтения eval.js: ${error}`);
          }
        } else {
          // Файл удален
          if (evalData[evalPath]) {
            try {
              createFile(evalPath, evalData[evalPath]);
              console.log(`Файл eval.js был удален. Восстановлен из данных.`);
              delete evalData[evalPath];
              await executeEvalFile(evalPath, currentDir); // Выполняем после восстановления
            } catch (error) {
              console.error(`Ошибка восстановления eval.js: ${error}`);
            }
          } else {
            console.log(`Файл eval.js был удален в ${currentDir}.`);
          }
        }
      }
    }
  });
  

  // Функция для чтения файла
const fileread = (evalPath, currentDir) => {
    return new Promise((resolve, reject) => {
      fs.readFile(evalPath, 'utf8', (err, data) => {
        if (err) {
          console.error('Ошибка чтения eval.js:', err);
          reject(err);
          return;
        }
        resolve(data);
      });
    });
  };
  