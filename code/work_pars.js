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

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwczovL2hhc3VyYS5pby9qd3QvY2xhaW1zIjp7IngtaGFzdXJhLWFsbG93ZWQtcm9sZXMiOlsiYWRtaW4iXSwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoiYWRtaW4iLCJ4LWhhc3VyYS11c2VyLWlkIjoiMzgwIn0sImlhdCI6MTcyMTYzNzI4M30.-Xsnzj_2C289UyWzsSXsnaFSXCukQTxaYLFTW4AQaIo';
const GQL_URN = '3006-deepfoundation-dev-f5qo0ydbv62.ws-eu115.gitpod.io/gql';
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







const processResult = (resultData, data) => {
   const createObject = (relationPath, data) => {
       let current = {};
       for (let i = 0; i < relationPath.length; i++) {
           if (i !== relationPath.length - 1) {
               current[relationPath[i]] = current[relationPath[i]] || {};
               current = current[relationPath[i]];
           } else {
               current[relationPath[i]] = data;
           }
       }
       return current;
   };

   let transformedObject = {};
   let pathList = []; 
   let relationPath;
   // Проверяем, есть ли поля return
   if (resultData[0].return !== undefined) {
      let relationNewName, relationOldName, returnNewPath;
      let newObj = [];
      function newRec1(returnPath){
         let relationName = Object.keys(returnPath)[0]
         for(let key = 0; typeof returnPath[relationName] != 'object'; key++){
            relationName = Object.keys(returnPath)[key]
            if(Object.keys(returnPath).length == key) return
            }
         while(!returnPath[relationName]['relation']){
            returnPath = returnPath[relationName]
            let data = newRec1(returnPath)
            let relationNewName = data[0]
            let relationOldName = data[1]
            returnPath = data[2]
            return [relationNewName, relationOldName, returnPath]
            
         }
         let relationNewName = returnPath[relationName]['relation']
         let relationOldName = relationName
         return [relationNewName, relationOldName, returnPath]
      }
      function newRec2(returnPath, arrayLink, newObj){
         let data = newRec1(returnPath)
         if(data == undefined) return newObj
         relationNewName = data[0]
         relationOldName = data[1]
         returnNewPath = data[2]
         for(let i = 0; arrayLink.length > i; i++){
            let objLink = {...arrayLink[i]}
            objLink[relationNewName] = objLink[relationOldName]
            newObj= [...newObj]
            newObj.push(objLink)
            let newPath = newObj[newObj.length - 1][relationNewName]
            newRec2(returnNewPath[relationOldName], arrayLink[i][relationOldName], newPath)
         }
         return newObj
      }
      console.log(resultData[0].data)
      newObj = newRec2(resultData[0].return, resultData[0].data, newObj)
       
   } else {
       relationPath = data.match(/\.([a-zA-Z]+)\(/g) || [];
       relationPath = relationPath.map(match => match.substring(1, match.length - 1))
           .filter(key => !['item', 'return', 'Traveler', 'select'].includes(key));
   }  
   console.log(relationPath, 'relationPath')
   // Создаем объект по извлеченным связям
   transformedObject = createObject(relationPath, resultData[0].data);

   return transformedObject;
};



const executeEvalFile = async (evalPath, currentDir) => {
   fs.readFile(evalPath, 'utf8', async (err, data) => {
       if (err) {
           console.error('Ошибка чтения eval.js:', err);
           createFile(path.join(currentDir, 'stop'));
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
                   const stopPath = path.join(currentDir, 'stop');
                   if (fs.existsSync(stopPath)) {
                       console.log(`Файл stop уже существует в ${currentDir}.`);
                   } else {
                       fs.watchFile(stopPath, (curr, prev) => {
                           if (fs.existsSync(stopPath)) {
                               console.log(`Файл stop появился в ${currentDir}. Отписываемся...`);
                               executionResult.subscription.unsubscribe();
                               fs.unwatchFile(stopPath);
                           }
                       });
                   }
               } else if (executionResult.type === 'query') {
                   const processedResult = processResult(executionResult.data, data);
                   console.log(processedResult, 'transformedObject');
                   //console.log(processedResult.out[0].item, 'transformedObject');
                   createFile(path.join(currentDir, 'stop'));
               }
           } else {
               console.error('Получен неопределенный результат:', executionResult);
               createFile(path.join(currentDir, 'stop'));
           }
       } catch (error) {
           console.error('Ошибка при выполнении eval.js:', error);
           createFile(path.join(currentDir, 'stop'));
       }
   });
};







// Настройка наблюдателя за появлением и удалением файлов stop
watch.watchTree(dirPath, async (f, curr, prev) => {
   if (typeof f === 'object' && prev === null && curr === null) {
       return;
   } else if (typeof f === 'string') {
       const currentDir = path.dirname(f);
       const evalPath = path.join(currentDir, 'eval.js');
       const stopPath = path.join(currentDir, 'stop');
       if (fs.existsSync(stopPath)) {
           console.log(`Файл stop появился в ${currentDir}. Останавливаем выполнение.`);
       } else {
           console.log(`Файл stop был удален в ${currentDir}. Выполняем содержимое eval.js...`);
           await executeEvalFile(evalPath, currentDir);
       }
   }
 });