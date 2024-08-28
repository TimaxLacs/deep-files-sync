import pkg from '@apollo/client/core/core.cjs';
const { ApolloClient, InMemoryCache, split, HttpLink } = pkg;
import { DeepClient, parseJwt } from "@deep-foundation/deeplinks/imports/client.js";
import { WebSocketLink } from '@apollo/client/link/ws/ws.cjs';
import { generateApolloClient } from "@deep-foundation/hasura/client.js";
import { Concast, getMainDefinition } from '@apollo/client/utilities/utilities.cjs';
import { SubscriptionClient } from 'subscriptions-transport-ws';
import ws from 'ws';
import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';

let evalData = {}; // Объект для хранения данных удаленных файлов
let subscriptionCount = 0;

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwczovL2hhc3VyYS5pby9qd3QvY2xhaW1zIjp7IngtaGFzdXJhLWFsbG93ZWQtcm9sZXMiOlsiYWRtaW4iXSwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoiYWRtaW4iLCJ4LWhhc3VyYS11c2VyLWlkIjoiMzgwIn0sImlhdCI6MTcyMTYzNzI4M30.-Xsnzj_2C289UyWzsSXsnaFSXCukQTxaYLFTW4AQaIo';
const GQL_URN = '3006-deepfoundation-dev-f5qo0ydbv62.ws-eu115.gitpod.io/gql';
const dirPath = '/home/timax/Code/Deep-project/deep-files-sync/test';



const makeDeepClient = token => {
  if (!token) throw new Error("No token provided")
  const decoded = parseJwt(token)
  const linkId = decoded.userId
  const apolloClient = generateApolloClient({
    path: GQL_URN,
    ssl: true,
    token
  })
  const deepClient = new DeepClient({ apolloClient, linkId, token })
  //console.log(deepClient);
  return deepClient
}




const makeDeepClientSub = (token) => {
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
let deepSub;

try {
    deep = makeDeepClient(token);
    deepSub = makeDeepClientSub(token);
} catch (error) {
    console.error('Could not create DeepClient:', error);
    process.exit(1);
}

// Функция для создания файла
const createFile = async (filePath, content = '') => {
  if (!await fs.promises.stat(filePath).catch(() => false)) {
      await fs.promises.writeFile(filePath, content, { flag: 'w' });
  }
};


const createDirectory = async (directoryPath) => {
 if (!await fs.promises.stat(directoryPath).catch(() => false)) {
     await fs.promises.mkdir(directoryPath, { recursive: true });
 }
};


const getIdFromFolderName = async (folderPath) => {
    const folderName = path.basename(folderPath); 
    return folderName.split('__')[0]; 
};


const getLinkName = async (linkId) => {
    const nameLink = await deep.select({
        type_id: 3,
        to_id: linkId,
    });
    if (nameLink.data.length > 0) {
        if(nameLink.data[0].value == null) return undefined
        return nameLink.data[0].value?.value;
    }

    return undefined;
}


const createValueFile = async (link, directoryPath) => {
  const valueFilePath = path.join(directoryPath, 'value.txt');

  // Получаем значение из объекта связи
  let valueContent = link.value !== null ? JSON.stringify(link.value.value) : 'null';

  // Проверяем, начинаются ли и заканчиваются ли строки двойными кавычками
  if (valueContent.startsWith('"') && valueContent.endsWith('"')) {
    // Обрезаем двойные кавычки по краям
    valueContent = valueContent.slice(1, -1);
  }

  // Создаем файл value.txt и записываем в него значение
  fs.writeFileSync(valueFilePath, valueContent, { flag: 'w' });
  console.log(`Создан файл ${valueFilePath} с содержимым: ${valueContent}`);
};


const createDataFile = async (link, directoryPath) => {
    const dataFilePath = path.join(directoryPath, 'data.json');

    // Создаем файл data.json и записываем в него значение
    fs.writeFileSync(dataFilePath, JSON.stringify(link), { flag: 'w' });
    console.log(`Создан файл ${dataFilePath} с содержимым: ${link.value}`);
};


const replaceFile = async (filedir, link) => {
  // console.log(filedir, link, 'filedir, link')
  try {
    if (typeof link !== 'object') {
        link = await deep.select({id: link});
    } else {
        link = await deep.select({id: link.id});
    }

    const fileContentString = JSON.stringify(link.data[0]);
    // console.log(fileContentString, 'fileContentString')
    await fs.promises.writeFile(filedir, fileContentString);
    console.log('Файл успешно обновлен на:', fileContentString);
  } catch (err) {
    console.error("Ошибка записи в файл:", err);
  }
}


const renameFolder = async (filedir, link, manually) => {
  try {
    let newFolderName;
    if (manually) {
      const folderNameParts = path.basename(filedir).split('__');
      let suffix = folderNameParts[folderNameParts.length - 1].split('—');
      if (suffix.length > 1) {
        suffix = '—' + suffix[1];
      } else {
        suffix = '';
      }
      if (manually === 'id') {
        folderNameParts[0] = link;
      } else if (manually === 'name') {
        folderNameParts[1] = link;
      } else if (manually === 'type') {
        newFolderName = folderNameParts[0] + '__' + link + suffix;
      }
    } else {
      // console.log(`поиск в {link}`);
      // console.log(link)
      if(typeof link != 'object') link = await deep.select({id: link})
      else link = await deep.select({id: link.id})
      const name = await getLinkName(link.data[0].id)
      let suffix = path.basename(filedir).split('—');
      if (suffix.length > 1) {
        suffix = '—' + suffix[1];
      } else {
        suffix = '';
      }
      newFolderName = name
        ? `${link.data[0].id}__${name}__${link.data[0].type_id}${suffix}`
        : `${link.data[0].id}__${link.data[0].type_id}${suffix}`;
    }
    const newFolderPath = path.join(path.dirname(filedir), newFolderName);

    await fs.promises.rename(filedir, newFolderPath);
    console.log(`Папка успешно переименована в ${newFolderName}`);
    return newFolderPath;
  } catch (err) {
    console.error("Ошибка при переименовании папки:", err);
  }
}

// Синхронизация значений в data.json с именем папки
const syncFolderNamesWithIds = (dirPath) => {
  const currentFolderName = path.basename(dirPath);
  const parts = currentFolderName.split('__');

  if (parts.length < 2) return; // Проверка на корректность формата

  const id = Number(parts[0]);
  const typeId = Number(parts[parts.length - 1]);

  const dataJsonPath = path.join(dirPath, 'data.json');

  if (fs.existsSync(dataJsonPath)) {
      let data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));

      // Обновляем data.json на основе имени папки (односторонняя синхронизация)
      if (data.id !== id || data.type_id !== typeId) {
          data.id = id;
          data.type_id = typeId;
          updateDataJson(dirPath, data);
      }
  }
};


// Обновление data.json
const updateDataJson = (dirPath, data) => {
   const dataJsonPath = path.join(dirPath, 'data.json');
   if (fs.existsSync(dataJsonPath)) {
     const currentData = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
 
     // Обновление только если есть изменения
     if (JSON.stringify(currentData) !== JSON.stringify(data)) {
       fs.writeFileSync(dataJsonPath, JSON.stringify(data, null, 2));
     }
   } else {
     // Файл data.json не существует, создаем его
     console.log("data.json обновлён в директории: " + path.dirname(dataJsonPath));
     fs.writeFileSync(dataJsonPath, JSON.stringify(data, null, 2));
   //   fs.writeFileSync(dataJsonPath, JSON.stringify(data, null, 2));
   }
 };


// Функция для сохранения данных подписки в файл
// const saveSubscriptionData = async (data, currentDir, type) => {
//   const subFileName = `sub${type}${subscriptionCount}.json`; // Уникальное имя файла
//   const subFilePath = path.join(currentDir, subFileName);
//   try {
//       fs.writeFileSync(subFilePath, JSON.stringify(data, null, 2));
//       console.log(`Сохранено значение подписки в файл ${subFileName}`);
//       subscriptionCount++; // Увеличиваем счетчик для следующего файла
//       return {
//           filePath: subFilePath,
//           folderName: subFileName.replace('.json', '') // Возвращаем имя папки без формата
//       };
//   } catch (error) {
//       console.error(`Ошибка сохранения данных подписки: ${error}`);
//   }
// };



// Функция для сохранения данных подписки в файл
const saveSubscriptionData = async (data, currentDir, type) => {
  let maxId = 0;
  const files = fs.readdirSync(currentDir)
      .filter(file => file.startsWith(`sub${type}`) && file.endsWith('.json'));

  if (files.length > 0) {
      files.forEach(file => {
          const id = parseInt(file.replace(`sub${type}`, '').replace('.json', ''));
          if (id > maxId) {
              maxId = id;
          }
      });
      maxId++;
  }

  const subFileName = `sub${type}${maxId}.json`;
  const subFilePath = path.join(currentDir, subFileName);

  try {
      // Преобразуем объект в строку
      const formattedData = JSON.stringify(data, null, 2); // Форматируем с отступами для читаемости

      // Записываем данные в файл
      fs.writeFileSync(subFilePath, formattedData); 

      console.log(`Сохранено значение подписки в файл ${subFileName}`);
      return {
          filePath: subFilePath,
          folderName: subFileName.replace('.json', '') // Возвращаем имя файла без формата
      };
  } catch (error) {
      console.error(`Ошибка сохранения данных подписки: ${error}`);
      return null; // Возвращаем null в случае ошибки
  }
};



// Функция для обработки подписки и настройки наблюдателей
const handleSubscriptionOut = async (data, currentDir) => {
  console.log(data, 'data'); // Логируем данные
  console.log(currentDir, 'currentDir'); // Логируем текущую директорию

  const subscriptionData = await saveSubscriptionData(data, currentDir, 'Out');
  
  try{

    console.log(subscriptionData, 'subscriptionData');

    const monitoredPaths = data.relationPath.concat(data.straightPath);

    monitoredPaths.forEach((monitoredPath) => {
        const fullPath = path.resolve(currentDir, monitoredPath);
        fs.watch(fullPath, async (eventType, filename) => {
            if (filename) {
                console.log(`Изменение обнаружено в: ${fullPath}`);
                await handleRequest(data, currentDir, fullPath);
            }
        });
    });

    // Для обработки отмены подписки
    fs.watchFile(subscriptionData.filePath, (curr, prev) => {
        if (!fs.existsSync(subscriptionData.filePath)) {
            console.log('Файл подписки удален. Отписываемся...');
            monitoredPaths.forEach(monitoredPath => {
                fs.unwatchFile(monitoredPath);
            });
            fs.unwatchFile(subscriptionData.filePath);
        }
    });
  } catch(error){
    console.error('Ошибка сохранения данных подписки', error);
  }
};




// Функция для загрузки и восстановления всех подписок при старте
const loadSubscriptionsOnStartup = (currentDir) => {
  const files = fs.readdirSync(currentDir);
  files.forEach(file => {
      if (file.startsWith('subOut') && file.endsWith('.json')) {
          const subscriptionFilePath = path.join(currentDir, file);
          const data = JSON.parse(fs.readFileSync(subscriptionFilePath, 'utf8'));
          handleSubscriptionOut(data, currentDir); // Восстанавливаем подписку
      }
  });
};
loadSubscriptionsOnStartup(dirPath)





// Функция для выполнения асинхронного кода
const executeAsync = async (code) => {
  return new Promise((resolve, reject) => {
      try {
          const func = async () => {
              return await eval(code);
          };
          resolve(func());
      } catch (err) {
          console.error(`Ошибка при выполнении кода: ${err}`);
          reject(err);
      }
  });
};


const executeAsync1 = async (func) => {
  try {
      return await func(); 
  } catch (err) {
      console.error(`Ошибка при выполнении команды: ${err}`);
      throw err; 
  }
};



const selectRelation = async (arrayLink, baseDir, subName = null) => {
    const idInFolder = await getIdFromFolderName(baseDir);
    let linkDir;
    let nameLink;

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
            } else {
                typeRelationDir = 'links';
            }
        }
        if (typeRelationDir) {
            const relationTypeDir = path.join(baseDir, typeRelationDir);
            await createDirectory(relationTypeDir);

            nameLink = await getLinkName(objLink.id);


            if (subName != null) await subClean(relationTypeDir, arrayLink[0].data, subName); // Используем номер подписки

            const newLinkDir = subName !== null 
              ? (nameLink ? `${objLink.id}__${nameLink}__${objLink.type_id}--${subName}` : `${objLink.id}__${objLink.type_id}--${subName}`)
              : (nameLink ? `${objLink.id}__${nameLink}__${objLink.type_id}` : `${objLink.id}__${objLink.type_id}`);


            linkDir = path.join(relationTypeDir, newLinkDir);


            // Проверка существования папки
            if (!fs.existsSync(linkDir)) {
                await createDirectory(linkDir);
            }

            await createValueFile(objLink, linkDir);
            await createDataFile(objLink, linkDir);
        } else {
            linkDir = baseDir;
        }

        await passingInLink(arrayLink[0].return, objLink, linkDir, subName);
    }
};

const passingInReturn = async (returnPath) => {
    let relationName = Object.keys(returnPath)[0];
    for (let key = 0; typeof returnPath[relationName] !== 'object'; key++) {
        relationName = Object.keys(returnPath)[key];
        if (Object.keys(returnPath).length <= key) return;
    }
 
    if (!returnPath[relationName]['relation']) {
        returnPath = returnPath[relationName];
        let data = await passingInReturn(returnPath);
        let relationNewName = data[0];
        let relationOldName = data[1];
        returnPath = data[2];
        return [relationNewName, relationOldName, returnPath];
    }
 
    let relationNewName = returnPath[relationName]['relation'];
    let relationOldName = relationName;
    return [relationNewName, relationOldName, returnPath];
 };
const passingInLink = async (returnPath, arrayLink, baseDir, subName = null) => {
    let data = await passingInReturn(returnPath);
    let nameLink;
    let newLinkDir;
    if (data === undefined) return;

    let relationNewName = data[0];
    let relationOldName = data[1];
    let returnNewPath = data[2];
    let newDir = path.join(baseDir, relationNewName);
    await createDirectory(newDir); 


    
    if (typeof arrayLink === 'object') arrayLink = arrayLink[relationOldName];
    if(arrayLink == null) return;
    if (!Array.isArray(arrayLink)) arrayLink = [arrayLink];


    for (let i = 0; arrayLink.length > i; i++) {
        if (subName != null) await subClean(relationTypeDir, arrayLink, subName); // Используем номер подписки

        nameLink = await getLinkName(arrayLink[i].id);
        const newLinkDirName = subName !== null 
          ? (nameLink ? `${arrayLink[i].id}__${nameLink}__${arrayLink[i].type_id}--${subName}` : `${arrayLink[i].id}__${arrayLink[i].type_id}--${subName}`)
          : (nameLink ? `${arrayLink[i].id}__${nameLink}__${arrayLink[i].type_id}` : `${arrayLink[i].id}__${arrayLink[i].type_id}`);

        newLinkDir = path.join(newDir, newLinkDirName);
  
        // Проверка существования папки
        if (!fs.existsSync(newLinkDir)) {
            await createDirectory(newLinkDir);
        }
        
        await createValueFile(arrayLink[i], newLinkDir);
        await createDataFile(arrayLink[i], newLinkDir);

        await passingInLink(returnNewPath[relationOldName], arrayLink[i], newLinkDir);
    }
};
















const executeEvalFile = async (evalPath, currentDir) => {
  fs.readFile(evalPath, 'utf8', async (err, data) => {
      if (err) {
          console.error('Ошибка чтения eval.js:', err);
          await createFile(path.join(currentDir, 'eval.js'));
          return;
      }

      try {
          let parsedData;
          try {
              parsedData = JSON.parse(data);
          } catch (parseError) {
              console.warn('Содержимое не является объектом, выполняем как обычный код.');
              const result = await executeAsync(data); // Получаем актуальные данные
              //console.log(result.data[0]);
            //   const test = await deep.select({id: 1012},{
            //     fetchPolicy: 'network-only' // Игнорирует кэш и всегда запрашивает свежие данные с сервера
            // })

              console.log('/////');
              console.log(result);
              //console.log(result.data[0]);
              console.log('/////');

              await processResult(result, data, currentDir);
              return;
          }

          if (typeof parsedData === 'object' && parsedData !== null) {
              if (parsedData.mode === 'req') {
                  await handleRequest(parsedData, currentDir);
              } else if (parsedData.mode === 'sub') {
                  await handleSubscriptionOut(parsedData, currentDir);
              } else {
                  console.error('Неизвестный режим:', parsedData.mode);
              }
          } else {
              console.error('Данные не являются корректным объектом:', parsedData);
          }
      } catch (error) {
          console.error('Ошибка при выполнении eval.js:', error);
          await createFile(path.join(currentDir, 'eval.js'));
      }
  });
};


const handleRequest = async (parsedData, currentDir) => {
  let commandResults;
  let straightPathData = [];
  let relationPathData = [];
  
  try {
    // Обработка команды, если есть
    if (parsedData.command) {
      commandResults = await executeAsync(parsedData.command);
      commandResults = commandResults.data; // Сохраняем данные результатов
    }


    // прямой запрос
    if (parsedData.straightPath && parsedData.straightPath.length > 0) {
      straightPathData = await processPath(parsedData.straightPath, currentDir, 'straight', commandResults);

      if (commandResults) await commandStraightSync(commandResults, straightPathData);
      else await noCommandStraightSync(straightPathData, currentDir);
    }

    // релейшн запрос
    if (parsedData.relationPath && parsedData.relationPath.length > 0) {
      relationPathData = await processPath(parsedData.relationPath, currentDir, 'relation', commandResults);
      let  commandRequestResult;
      //console.log(commandResults, '------1111')
      if (commandResults) {
        //console.log(commandResults, '------')
        await checResultsWithCurrent(commandResults, relationPathData);
      }
      else {
        await checResultsWithCurrent(relationPathData.queries, relationPathData);
        //commandResults = await executeAsync(`deep.select(${relationPathData.queries})`);
        // console.log(relationPathData.queries, 'relationPathData.queries--')
        // for(const folderRequest of relationPathData.queries){
        //   console.log(folderRequest)
        //   console.log(`${folderRequest}`)
        //   console.log(`${folderRequest}`, '========')
        //   commandRequestResult = await executeAsync1(() => deep.select(folderRequest));
        //   console.log(commandRequestResult)
        //   console.log('commandRequestResult')
        //   await checResultsWithCurrent(commandRequestResult, relationPathData);
        // }
      }
    }

  } catch (error) {
      console.error('Ошибка при выполнении команды:', error);
      await createFile(path.join(currentDir, 'error.txt'), `${error}`);
  }
};



const checResultsWithCurrent = async (commandInstructions, relationPathData) => {
  console.log('*************');
  console.log(relationPathData);
  console.log(relationPathData.results[0]);
  console.log(relationPathData.results[0].outText);
  console.log('*************');
  const updatedPaths = []; // Массив для хранения путей и изменений

  // Итеративная обработка связей
  const processLinksIteratively = async (linkReq, linkFolder) => {
      console.log('Обновление связи', linkReq.id);
      console.log('//////////');
      console.log(linkFolder);
      console.log('//////////');
      const stack = [{ linkReq, linkFolder }];

      while (stack.length > 0) {
          const { linkReq, linkFolder } = stack.pop();
          console.log(linkReq, 'linkReq11111.');
          console.log(linkFolder, 'linkFolder11111.');
          // Обработка ключей для обновления
          for (const key of Object.keys(linkReq)) {
            console.log(key,'keykeykeykeykey')
              if (linkReq[key] !== linkFolder[key]) {
                  if (typeof linkReq[key] !== 'object') {
                      console.log('Обновляем', key, 'для', linkReq.id, 'на:', linkFolder[key]);
                      const update = await deep.update({ id: linkReq.id }, { [key]: linkFolder[key] });
                      console.log(update,'update')
                  } else if (key === 'value' && typeof linkReq[key] === 'object') {
                    console.log(linkFolder[key].value,'valuevaluevaluevalue')
                    console.log(linkReq.id,'linkReq.id')
                      const update = await deep.update(
                          { link_id: linkReq.id },
                          { value: linkFolder[key].value },
                          { table: (typeof linkFolder[key].value) + 's' }
                      );
                      console.log(update,'update')
                  } else {
                      const linkReqValue = Array.isArray(linkReq[key]) ? linkReq[key] : [linkReq[key]];
                      const linkFolderValue = Array.isArray(linkFolder[key]) ? linkFolder[key] : [linkFolder[key]];

                      for (let i = 0; i < linkReqValue.length; i++) {
                          const matchingFolderLink = linkFolderValue.find(folderLink => folderLink.id === linkReqValue[i].id);
                          if (matchingFolderLink) {
                              stack.push({ linkReq: linkReqValue[i], linkFolder: matchingFolderLink });
                          } else {
                              // console.log(linkFolderValue, 'linkFolderValue.');
                              // console.log(linkFolder, 'linkFolder.');
                              // console.log(linkReqValue, 'linkReqValue.');
                              console.log('Связь', linkReqValue[i].id, 'не найдена в папке.');
                          }
                      }
                  }
              }
          }
      }

      // Сохраняем путь и данные для обновления
      const linkPath = relationPathData.path.find(pathResult => pathResult.id === linkReq.id);
      if (linkPath) {
          const newValue = Object.assign({}, linkFolder); // Клонируем объект для безопасного обновления
          updatedPaths.push({ path1: linkPath.path, value: newValue }); // Добавляем в массив обновляемых путей
      }
  };


  const processPendingLinks = async (linkList) => {
    for (let j = linkList.length - 1; j >= 0; j--) {
      console.log('список всез связей', linkList);
        const pendingLink = linkList[j];
        const existingLink = linksReq.find(result => result.id === pendingLink.id);

        if (existingLink) {
            console.log('Обновляем пропущенную связь:', pendingLink.id);
            await processLinksIteratively(existingLink, pendingLink);
        } else {
            console.log('Добавляем пропущенную связь:', pendingLink.id);
            await processNewLinks([pendingLink]);
        }
    }
};

// Обработка новых связей
const processNewLinks = async (newLinks) => {
    const stack = [...newLinks];

    while (stack.length > 0) {
        const newLink = stack.pop();
        console.log('Обработка новой связи:', newLink.id);

        console.log(newLink);

        const existingLink = await deep.select({ id: newLink.id });
        if (!existingLink.data.length) {
            const data = {
                from_id: newLink.from_id,
                type_id: newLink.type_id,
                to_id: newLink.to_id
            };
            if (newLink.value) {
                data.string = { data: { value: newLink.value.value } };
            }
            const insert = await deep.insert(data);
            await updateOldLinks(newLinks, newLink.id, insert.data[0].id);
            console.log('Создана новая связь:', JSON.stringify(data));
        } else {
            // Обновление для всех ключей
            await deep.update(
              { id: newLink.id },
              { from_id: newLink.from_id },
            );
            await deep.update(
              { id: newLink.id },
              { type_id: newLink.type_id },
            );
            await deep.update(
              { id: newLink.id },
              { to_id: newLink.to_id }
            );
            if (newLink.value) {
                await deep.update(
                    { link_id: newLink.id },
                    { value: newLink.value?.value },
                    { table: (typeof newLink.value?.value) + 's' }
                );
            }
            console.log('Обновление существующей связи:', newLink.id);
        }

        // Сохраняем путь и данные для обновления
        const linkPath = relationPathData.path.find(pathResult => pathResult.id === newLink.id);
        if (linkPath) {
          const newValue = Object.assign({}, newLink); // Клонируем объект


          // Проверка на наличие в updatedPaths по id для предотвращения дублирования
          const existingPath = updatedPaths.find(item => item.value.id === newValue.id);
          if (existingPath) existingPath.value = newValue; // Обновляем существующее значение
          else updatedPaths.push({ path1: linkPath.path, value: newValue }); // Добавляем новое значение
          
          //updatedPaths.push({ path1: linkPath.path, value: newValue });
          }

      // Проходим по всем вложенным объектам
      for (const key of Object.keys(newLink)) {
          if (typeof newLink[key] === 'object' && newLink[key] !== null && key !== '__typename' && key !== 'value') {
              const childLinks = Array.isArray(newLink[key]) ? newLink[key] : [newLink[key]];
              stack.push(...childLinks);  // Добавляем все вложенные связи
          }
      }
  }
};


// Функция для обновления файлов на основе собранных данных
const updateFilePaths = async () => {
  // Сортировка по длине пути для корректного обновления
  // console.log(updatedPaths, 'updatedPaths')
  updatedPaths.sort((a, b) => b.path1.length - a.path1.length);
  for (const { path1, value } of updatedPaths) {
      const dataPath = path.join(path1, 'data.json');
      await replaceFile(dataPath, value.id);
      await renameFolder(path1, value.id);
      console.log('Обновлены данные в папке:', path1);
  }
};

// Функция для обновления старых ID на новые (обработает как объект, так и массив)
const updateOldLinks = async(links, oldId, newId) => {
  // Обработка массива или одиночного объекта
  const linksArray = Array.isArray(links) ? links : [links];
  
  const stack = [...linksArray]; // Используем стек для обхода без рекурсии

  while (stack.length > 0) {
      const link = stack.pop();

      // Обновляем ссылки в данной связи
      if (link.from_id === oldId) {
          link.from_id = newId;
      }
      if (link.to_id === oldId) {
          link.to_id = newId;
      }
      if (link.type_id === oldId) {
        link.type_id = newId;
      }
      if (link.id === oldId) {
        link.id = newId;
      }

      for(let pathAndId in relationPathData.path){
        if(relationPathData.path[pathAndId].id == oldId) relationPathData.path[pathAndId].id = newId
      }

      // Добавляем вложенные объекты или массивы в стек
      for (const key in link) {
          if (Array.isArray(link[key])) {
              stack.push(...link[key]); // Добавляем все элементы массивов
          } else if (typeof link[key] === 'object' && link[key] !== null) {
              stack.push(link[key]); // Добавляем вложенные объекты
          }
      }
  }
};




// 1. Обработка на корневом уровне, используя итеративный подход
const linksReq = [];

for (const commandDetail of commandInstructions) {
  const commandResult = await executeAsync1(() => deep.select(commandDetail));
  linksReq.push(...commandResult.data);
}

console.log(relationPathData.results, 'relationPathData.results');
console.log(linksReq, 'linksReq');

const stack1 = [{ linksReq, linksFolder: relationPathData.results }];

while (stack1.length > 0) {
    const { linksReq, linksFolder } = stack1.pop();

    const numCycle = Math.max(linksReq.length, linksFolder.length);
    for (let i = 0; i < numCycle; i++) {
        const linkReq = linksReq[i];
        const linkFolder = linksFolder[i];

        // Обработка отсутствующих объектов
        if (!linkReq && linkFolder) {
            console.log('Добавляем пропущенные связи из папковой структуры:', linkFolder.id);
            await processNewLinks(Array.isArray(linkFolder) ? linkFolder : [linkFolder]);
        }

        if (!linkFolder) {
            console.log('Продолжаем, так как linkFolder отсутствует.');
            continue;
        }


        console.log(JSON.stringify(linkReq), 'JSON.stringify(linkReq)+++++++++++++++++')
        console.log(JSON.stringify(linkFolder), 'JSON.stringify(linkFolder)+++++++++++++++++')
        if (JSON.stringify(linkReq) === JSON.stringify(linkFolder)) continue; // Проверка на абсолютное совпадение

        const relationPath = relationPathData.queries[i];
        let relatableLinks = []; // Для хранения пропущенных связей
        let rootData; // Данные для корневой связи

        // Ищем корневую связь
        const relationStack = [{ link: linkFolder, path: relationPath }];
        while (relationStack.length > 0) {
            const { link, path } = relationStack.pop();
            console.log(link, path, 'link, path')
            for (const key in link) {
                if (link[key] !== null && key !== '__typename' && key !== 'value') {
                    const isCoreRelation = ['from', 'to', 'type'].includes(path?.return[key]?.relation);
                    if (isCoreRelation) {
                        relatableLinks.push(link); // Пропускаем не корневые связи
                    } else {
                        rootData = link; // сохраняем корневую связь
                    }
                } 
            }
        }

        // Проверяем наличие корневой связи на уровне linksReq
        const compareLink = linksReq.find(result => result.id === rootData.id);
        if (compareLink) {
            console.log('Корневая связь найдена. Обновляем...', rootData.id);
            await processLinksIteratively(compareLink, rootData);
        } else {
            console.log(rootData, 'rootData')
            console.log('Корневая связь не найдена. Добавляем...', rootData.id);
            await processNewLinks([rootData]);
        }

        // Обработка пропущенных связей (с конца)
        await processPendingLinks(relatableLinks);

        // Углубляемся в остальные связи
        for (const key of Object.keys(linkFolder)) {
            if (typeof linkFolder[key] === 'object' && linkFolder[key] !== null && key !== '__typename' && key !== 'value') {
                const newlinkReq = (linkReq && linkReq[key]) ? (Array.isArray(linkReq[key]) ? linkReq[key] : [linkReq[key]]) : [];
                const newlinkFolder = (linkFolder[key]) ? (Array.isArray(linkFolder[key]) ? linkFolder[key] : [linkFolder[key]]) : [];
                stack1.push({ linksReq: newlinkReq, linksFolder: newlinkFolder });
            }
        }
    }
}

// Обновление файлов после всех вставок и обновлений
await updateFilePaths();


// 3. Сравнение и обновление названий связей
for (const id in relationPathData.listNameLink) {
    if (relationPathData.listNameLink[id]) {
        const linkName = await getLinkName(id);
        if (linkName !== relationPathData.listNameLink[id]) {
            await deep.update(
              { id: id },
              { value: relationPathData.listNameLink[id] },
              { table: 'strings' }
          );
      }
  }
}
};



  



  const processPath = async (straightPath, currentDir, mode, commandRelation) => {
  
    let results = [];
    const listNameLink = {};
    const pathResults = [];
    let nameLink;
    let queries = [];
    for (const userPath of straightPath) {
      let cleanPath = userPath;
  
      if (userPath.startsWith('-')) {
        cleanPath = userPath.substring(1); 
      }
    
      if (userPath.endsWith('~')) {
        cleanPath = userPath.substring(0, userPath.length - 1); 
      }
      
      let absoluteCleanPath = path.join(currentDir, cleanPath);
  
      if(path.basename(absoluteCleanPath) === 'data.json' || path.basename(absoluteCleanPath) === 'data.json~'){
        absoluteCleanPath = path.dirname(absoluteCleanPath).split(path.sep).pop();
      }
  
      // проверка по id папки-связи
      if (!fs.existsSync(absoluteCleanPath)) {
          const lastDirectory = path.basename(path.dirname(absoluteCleanPath));
          const firstValue = lastDirectory.split('__')[0];
          const parentDirectory = path.dirname(path.dirname(absoluteCleanPath));
          const parentDirectory1 = path.dirname(path.dirname(cleanPath));
          cleanPath = fs.readdirSync(parentDirectory1).find(folder => folder.startsWith(`${firstValue}__`));  
          absoluteCleanPath = fs.readdirSync(parentDirectory).find(folder => folder.startsWith(`${firstValue}__`));  
  
          if (!fs.existsSync(absoluteCleanPath)) {
            console.warn(`Путь не существует: ${absoluteCleanPath}`);
            continue; 
          }
        }
 
      if (fs.existsSync(absoluteCleanPath)) {
        const files = fs.readdirSync(absoluteCleanPath);
        const hasRelationFiles = files.includes('data.json') && files.includes('value.txt');
  
        // если папка - папка-связь
        if (hasRelationFiles) {
          // обрабатываем файл data.json
          const dataFilePath = path.join(absoluteCleanPath, 'data.json');
          const folderName = path.basename(absoluteCleanPath);
          let data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
          data = {...data};
          if(data.data) data = data.data[0];

          //console.log(mode, 'mode')
          if(mode == 'straight'){
  
            // удаляем, если пользователь указан на это
            if(userPath.startsWith("-")){
              await deep.delete({id:data.id});
              continue;
            }
  
            // Читаем значение из value.txt
            let value = fs.readFileSync(path.join(absoluteCleanPath, 'value.txt'), 'utf-8');
            if(value == 'null') value = null;
            if(data.value || data.value != null) {
              if(data.value.value != value) data.value.value = value;
            }
  
            // Получаем имя ссылки 
            nameLink = folderName.split('__').length >= 3 ? folderName.split('__')[1] : await getLinkName(data.id);
  

            console.log(data,'data33333333333333333')
            // обновляем данные 
            listNameLink[data.id] = nameLink;
            pathResults.push({ id: data.id, path: absoluteCleanPath });
            results.push(data);
          }
          else if(mode == 'relation'){
            cleanPath = path.join(path.basename(currentDir), cleanPath);
            const currentDirNotOneDir = path.dirname(currentDir)
            const pathParts = cleanPath.split(path.sep);
            for (let i = pathParts.length - 1; i >= 0; i--) {
              const currentDir1 = pathParts.slice(0, i + 1).join(path.sep);
              //console.log(path.join(currentDirNotOneDir, currentDir1), 'dirdirdirdirdir')
              if (fs.existsSync(path.join(path.join(currentDirNotOneDir, currentDir1), 'data.json'))) {
                const dataFilePath = path.join(path.join(currentDirNotOneDir, currentDir1), 'data.json');
                const folderName = path.basename(path.join(currentDirNotOneDir, currentDir1));
                
                //console.log(folderName, 'folderName')
                data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
                data = {...data}
                if(data.data) data = data.data[0]
                //console.log(data, 'data----')

                // Вызов функции обновления данных на основе папок отношений
                await updateDataFromRelations(path.join(currentDirNotOneDir, currentDir1));
  
                //  удаляем, если пользователь указал на это
                if(userPath.startsWith("-")){
                  await deep.delete({id: data.id});
                  continue;
                }
  
  
                if (!nameLink && folderName.split('__').length >= 3) nameLink = folderName.split('__')[1];
                else nameLink = await getLinkName(data.id);
  
                // обновляем данные 
                listNameLink[data.id] = nameLink;
                pathResults.push({ id: data.id, path: path.join(currentDirNotOneDir, currentDir1) }); // Добавляем id и путь текущей связи-папки
              }
            }
            if(userPath.startsWith("-")){
              continue;
            }
  
            // обновляем данные
            //pathResults.push({ id: data.id, path: absoluteCleanPath });
            //console.log(cleanPath, 'cleanPath00000')
            //console.log(data, 'data00000')
        
            //console.log(commandRelation, 'commandRelation00000')
            const pathToObjResult = await pathToObjResultAndSelect(path.dirname(currentDir), cleanPath, data, commandRelation);
            console.log(queries, 'queries')
            console.log(pathToObjResult.queries, 'pathToObjResult.queries')
            queries.push(...pathToObjResult.queries);
            results.push(...[pathToObjResult.result]);
          }
          //console.log('Обработаны данные связи из папки:', data);
        } 
        // если нужны все папки внутри только этой директории
        else if(userPath.endsWith("~")){
          // Папка, нужная для поиска связанных папок — рекурсивно обрабатываем ее
          const linkDirs = files.filter(file => fs.statSync(path.join(absoluteCleanPath, file)).isDirectory());
  
          for (const linkDir of linkDirs) {
            const dataFilePath = path.join(linkDir, 'data.json');
            const folderName = path.basename(linkDir);
            let data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
            data = {...data};
            if(data.data) data = data.data[0];
  
  
            if(mode == 'straight'){
              // удаляем, если пользователь указал на это 
              if(userPath.startsWith("-")){
                await deep.delete({id:data.id})
                continue;
              }
  
              // Читаем значение из value.txt
              let value = fs.readFileSync(path.join(linkDir, 'value.txt'), 'utf-8');
              if(value == 'null') value = null;
              if(data.value || data.value != null) {
                if(data.value.value != value) data.value.value = value;
              }
  
              // Получаем имя ссылки 
              nameLink = folderName.split('__').length >= 3 ? folderName.split('__')[1] : await getLinkName(data.id);
  
  
              // обновляем данные
              listNameLink[data.id] = nameLink
              pathResults.push({ id: data.id, path: linkDir });
              results.push(data);
            }
            else if(mode == 'relation'){
              //console.log('REEEEELAAATION')
              const pathParts = absoluteCleanPath.split(path.sep);
              const currentDirNotOneDir = path.dirname(currentDir)
              for (let i = pathParts.length - 1; i >= 0; i--) {
                const dir = pathParts.slice(0, i + 1).join(path.sep);
                if (fs.existsSync(path.join(path.join(currentDirNotOneDir, dir), 'data.json'))) {
                  const dataFilePath = path.join(path.join(currentDirNotOneDir, dir), 'data.json');
                  const folderName = path.basename(path.join(currentDirNotOneDir, dir));
                  data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
                  data = {...data};
                  if(data.data) data = data.data[0]
 
                  // Вызов функции обновления данных на основе папок отношений
                  await updateDataFromRelations(path.join(currentDirNotOneDir, dir));
  
                  // удаляем, если пользователь указал на это 
                  if(userPath.startsWith("-")){
                    await deep.delete({id:data.id})
                    continue;
                  }
  
                  if (!nameLink && folderName.split('__').length >= 3) nameLink = folderName.split('__')[1];
                  else nameLink = await getLinkName(data.id);
  
                  // обновляем данные
                  listNameLink[data.id] = nameLink;
                  pathResults.push({ id: data.id, path: path.join(currentDirNotOneDir, dir) }); // Добавляем id и путь текущей связи-папки
                  //console.log(pathResults, 'pathResults')
                }
              }
              if(userPath.startsWith("-")){
                continue;
              }
  
              // обновляем данные
              //pathResults.push({ id: data.id, path: linkDir }); 

              
              const pathToObjResult = await pathToObjResultAndSelect(path.dirname(currentDir), path.relative(currentDir, linkDir), data, commandRelation);
              queries.push(...pathToObjResult.queries);
              results.push(...[pathToObjResult.result]);

            }
            //console.log('Обработаны данные связи из папки:', data);
          }
        }
        // пробуем поиск по релейшену
        else{
          // Папка, нужная для поиска связанных папок — рекурсивно обрабатываем ее
          const linkDirs = files.filter(file => fs.statSync(path.join(absoluteCleanPath, file)).isDirectory());
  
          for (const linkDir of linkDirs) {
            let linkDirPath = path.join(absoluteCleanPath, linkDir);
  
            // удаляем, если пользователь указал на это 
            if(userPath.startsWith("-")){
              linkDirPath = `-${linkDirPath}`
            }
  
            // Запускаем рекурсивный вызов и собираем результаты
            const linkResults = await processPath([linkDirPath], currentDir, mode, commandRelation);
        
            if(mode == 'straight'){
              // обновляем данные
              results.push(...linkResults.results); // Делаем "распаковку" массива
              pathResults.push(...linkResults.pathResults); // Делаем "распаковку"массива
              Object.assign(listNameLink, linkResults.listNameLink); // Объединяем списки имен ссылок
            }
            else if(mode == 'relation'){

               // Вызов функции обновления данных на основе папок отношений
               await updateDataJsonWithRelations(absoluteCleanPath);
               
              // обновляем данные
              const data = {...linkResults.results};
              const pathToObjResult = await pathToObjResultAndSelect(path.dirname(currentDir), path.relative(currentDir, linkDir), data, commandRelation);
              queries.push(...pathToObjResult.queries);
              results.push(...[pathToObjResult.result]);
              pathResults.push(...linkResults.pathResults); // Делаем "распаковку"массива
              Object.assign(listNameLink, linkResults.listNameLink); // Объединяем списки имен ссылок
            }
          }
        }
      } 
      else {
        console.warn(`Путь не существует: ${absoluteCleanPath}`);
      }
    }
  
    return { results: results, listNameLink: listNameLink, path: pathResults, queries: queries }; // Возвращаем результаты и список имен ссылок
  };
     
  


  const pathToObjResultAndSelect = async (currentPath, relationFolderPath, data, relations) => {
    const segments = relationFolderPath.split(path.sep);
    let currentObject = data; // Используем изначально переданный объект как корневой
    let foundData = false;
    let relationsPath = relations;
    let queries;
    let returnObj;
    let query;
    for (var i = 0; i < segments.length; i++) {
        let pathSoFar = '';
        for (let j = 0; j <= i; j++) {

          pathSoFar = path.join(pathSoFar, segments[j]);

        }

        pathSoFar = path.join(currentPath, pathSoFar);

        if (fs.existsSync(pathSoFar) && fs.statSync(pathSoFar).isDirectory()) {
            const dataFilePath = path.join(pathSoFar, 'data.json');
            if (fs.existsSync(dataFilePath)) {
                const newData = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
                // console.log(newData, 'newData')
                if (!foundData) {
                    // Если это первая найденная папка с data.json, используем её как корневой объект
                    Object.assign(currentObject, newData);
                    foundData = true;
                    continue; // Переходим к следующему сегменту
                }

                // Логика для работы с отношениями
                let relationName = segments[i-1] + 'Text';
                for (const key in relationsPath) {
                    if (relationsPath[key].relation === segments[i]) {
                        relationName = key;
                        relationsPath = relationsPath[key].return;
                        break;
                    }
                }

                if (!currentObject.hasOwnProperty(relationName)) {
                    currentObject[relationName] = newData;
                } else {
                    Object.assign(currentObject[relationName], newData);
                }

                currentObject = currentObject[relationName]; // Обновляем текущий объект
                if (!relations) {
                    if (foundData && queries) {
                        returnObj = queries[queries.length - 1].return;
                        for (let k = 1; k < (i-1); k++) {
                          returnObj = returnObj[Object.keys(returnObj)[0]].return;
                          returnObj[relationName] = { relation: segments[i-1], return: {} };
                        }
                    } else{
                        const dataLinkOne = JSON.parse(fs.readFileSync(path.join(path.dirname(path.dirname(pathSoFar)), 'data.json'), 'utf-8'));
                        if(!query){
                          query = {
                              id: dataLinkOne.id,
                              return: {}
                          };
                        } else query = query
                        query.return[relationName] = { relation: segments[i-1], return: {} };
                        if(queries == undefined) queries = []
                        queries.push(query);
                    }
                }
            }
        }
    }

    return { result: data, queries: queries };
};




const noCommandStraightSync = async (straightPathResults, currentDir) => {

  for (const linkFolder of straightPathResults.results) {


    const linkId = linkFolder.id;
    const linkPath = straightPathResults.path.find(pathResult => pathResult.id === linkId)
    const dataPath = path.join(linkPath.path, 'data.json');

    
    // Проверка существования связи в БД по linkId
    const currentLink = await deep.select({ id: linkId });
    console.log(currentLink);
    const nameLink = await getLinkName(linkId);
    const nameFolderLink = straightPathResults.listNameLink[linkId];      


    // if (!fs.existsSync(linkPath) || !fs.existsSync(dataPath)) {
    //   console.warn(`Путь ${linkPath} или файл ${dataPath} не найдены!`);
    //   await deep.delete({id: linkId})
    //   console.warn(`связь  ${linkPath} удалена!`);
    //   continue; // Переходим к следующей связи
    // }


    
    // Если текущей связи нет в БД, создаем новую
    if (!currentLink || currentLink.data.length === 0) {
        let newLink;
        if (linkFolder.value) {
            newLink = await deep.insert({
              from_id: linkFolder.from_id,
              to_id: linkFolder.to_id,
              type_id: linkFolder.type_id,
              string: { data: { value: linkFolder.value.value } },
          });
        } else {
            newLink = await deep.insert({
              from_id: linkFolder.from_id,
              to_id: linkFolder.to_id,
              type_id: linkFolder.type_id,
          });
        }
        console.log(`Создана новая связь с id ${newLink.data[0].id}`);


          // обновление data.json           
        console.log(`измененно значение  в файле ${dataPath} на ${newLink.data[0]}`);
        await replaceFile(dataPath, newLink.data[0])
        // обновление названия
        await renameFolder(linkPath.path, newLink.data[0])
    } else {
      // Если связь найдена, обновляем значения
      const existingLink = currentLink.data[0]; // Считаем, что мы получили нужный объект

      // Проверяем и обновляем name
      if (nameFolderLink != nameLink) {
  

        const contain = await deep.select({ type_id: 3, to_id: linkId })  // нужно что-то придмать с тем, чтобы это работало и в пустых контейнах. сейчас он изменяет содержимое только если оно уже есть
        await deep.update(
          { link_id: contain.data[0].id },
          { value: nameFolderLink },
          { table: (typeof nameFolderLink) + 's' }
        );      
        
        console.log(`Обновлена связь ${linkId}`);
      }
      if (existingLink.to_id !== linkFolder.to_id){
        await deep.update(
          {id: linkId },
          {to_id: linkFolder.to_id }
        );
        console.log(`Обновлена связь id ${linkId} на`);
        console.log({ to_id: linkFolder.to_id })
      }
      if (existingLink.from_id !== linkFolder.from_id){
        await deep.update(
          {id: linkId },
          {from_id: linkFolder.from_id}
          );
        console.log(`Обновлена связь id ${linkId} на`);
        console.log({from_id: linkFolder.from_id})
      }
      if (existingLink.type_id !== linkFolder.type_id){
        await deep.update(
          {id: linkId },
          {type_id: linkFolder.type_id}
          );
        console.log(`Обновлена связь id ${linkId} на`);
        console.log({type_id: linkFolder.type_id})
        await renameFolder(linkPath.path, linkId)
        }
      if ((existingLink.value !== linkFolder.value) && existingLink.value != null) {
        if(linkFolder.value != null || linkFolder.value != undefined){
          await deep.update(
            {
              link_id: linkId
            },
            {
              value: linkFolder.value.value
            },
            {
              table: (typeof linkFolder.value.value) + 's'
            },
          );
        console.log(`Обновлена связь id ${linkId} на`);
        console.log({value: linkFolder.value.value})
        }
      }     
      }

  }
};




const commandStraightSync = async (commandResults, straightPathData) => {
  let listNameLink = straightPathData.listNameLink
  let listValueDataLink = straightPathData.results
  let pathResults = straightPathData.path
  const idFolderLink = straightPathData.results.id
  const idSetFromStraightPath = new Set(listValueDataLink.map(item => item.id));
  

  // Перебираем значения из списка папок-связей
  for (const straightPathResult of listValueDataLink) {

      const originalId = Number(straightPathResult.id);  // id из папки-связи
      const linkPath = pathResults.find(pathResult => pathResult.id === originalId)
      const dataPath = path.join(linkPath.path, 'data.json');


      // Если в списке команд (commandResults) нет id, который есть в списке папок (listValueDataLink)
      if (!commandResults.some(commandResult => commandResult.id === originalId)) {

          // Ищем в БД связь с таким id
          const existingConnection = await deep.select({ id: originalId });

          // Если нет, то добавляем связь
          if (existingConnection.data.length === 0) {
              const nameLink = listNameLink[originalId] || ""

              if(straightPathResult.from_id == null || straightPathResult.to_id == null|| straightPathResult.type_id == null) continue;
              // Создаем новую связь с указанной структурой
              let newLink;
              if (straightPathResult.value) {
                console.log('добавление новой связи с значением:', straightPathResult.value.value)
                newLink = await deep.insert({
                  from_id: straightPathResult.from_id,
                  to_id: straightPathResult.to_id,
                  type_id: straightPathResult.type_id,
                  string: { data: { value: straightPathResult.value.value } },
                });
              } else {
                console.log('добавление новой связи без значения:')
                newLink = await deep.insert({
                  from_id: straightPathResult.from_id,
                  to_id: straightPathResult.to_id,
                  type_id: straightPathResult.type_id,
                });
              }
              if (nameLink) {
                const contain = await deep.insert({
                  from_id: 380,
                  to_id: newLink.data[0].id,
                  type_id: 3,
                  string: { data: { value: nameLink } },
                });
                console.log(`Добавлена контейн-связь ${contain.data[0].id} с содержимым ${nameLink}`);
              }

               // обновление data.json           
              console.log(`измененно значение  в файле ${dataPath} на ${newLink.data[0]}`);
              await replaceFile(dataPath, newLink.data[0])
              // обновление названия папки-связи
              console.log(`измененно название папки-связи с  ${linkPath} на ${newLink.data[0]}`);
              await renameFolder(linkPath.path, newLink.data[0])

              console.log(`Добавлена связь ${originalId} из ${straightPathResult.from_id} в ${straightPathResult.to_id} с новым id ${newLink.data[0].id}`);
          }
      } else {
          // Если id совпадают, но другие значения этого объекта отсутствуют
          const commandResult = commandResults.find(cmdResult => cmdResult.id === originalId);
          if (commandResult) {

            const idFolderLink = straightPathResult.id;

            const nameLinkFolder = listNameLink[idFolderLink] || ""
            const nameLinkCurrent = await getLinkName(idFolderLink)

            if(nameLinkCurrent != nameLinkFolder){ // нужно что-то придмать с тем, чтобы это работало и в пустых контейнах. сейчас он изменяет содержимое только если оно уже есть
              const contain = await deep.select({ type_id: 3, to: { id: idFolderLink } })
              console.log('попытка изменить связь', contain.data[0].id)
              await deep.update(
                { link_id: contain.data[0].id },
                { value: nameLinkFolder },
                { table: (typeof nameLinkFolder) + 's' }
              );   
            }
            if (JSON.stringify(commandResult) !== JSON.stringify(straightPathResult)) {
              let updatesTo = {};
              let updatesType = {};
              let updatesFrom = {};
              let updatesValue1 = {};
              let updatesValue2 = {};
          
              if (commandResult.to_id !== straightPathResult.to_id){
                await deep.update( 
                  {id: originalId },
                  {to_id: straightPathResult.to_id }
                  );      
                  console.log(`Обновлена связь с id ${originalId} на`);
                  console.log({to_id: straightPathResult.to_id })
              }
                
              if (commandResult.from_id !== straightPathResult.from_id){
                await deep.update( 
                  {id: originalId },
                  {from_id: straightPathResult.from_id}
                  );      
                  console.log(`Обновлена связь с id ${originalId} на`);
                  console.log({from_id: straightPathResult.from_id})
              }
              if (commandResult.type_id !== straightPathResult.type_id){
                await deep.update( 
                  {id: originalId },
                  {type_id: straightPathResult.type_id}
                  );   
                  console.log(`Обновлена связь с id ${originalId} на`);
                  console.log({type_id: straightPathResult.type_id})
              }
              if (commandResult.value !== straightPathResult.value) {
                if((straightPathResult.value != null || straightPathResult.value != undefined )&& straightPathResult.value != null){
                  if (commandResult.value.value !== straightPathResult.value.value) {
                    await deep.update(
                      { link_id: originalId },
                      { value: straightPathResult.value.value },
                      { table: (typeof straightPathResult.value.value) + 's' }
                    );
                  console.log(`Обновлена связь с id ${originalId} на`);
                  console.log({ value: straightPathResult.value.value })
                  } else{
                    await deep.update(
                      { link_id: originalId },
                      { value: " " },
                      { table: 'strings' }
                    );
                  console.log(`Обновлена связь с id ${originalId} на`);
                  console.log( { value: " " })
                  }
                }
            }    
            }
      }
  }

  // Удаляем лишние записи в БД
  const idSetFromCommandResults = new Set(commandResults.map(item => item.id));
  const listValueDataLinkId = new Set(listValueDataLink.map(item => item.id));

  // Перебираем связи из папочной структуры
  for (const idSetFromCommandResult of idSetFromCommandResults) {
      // Если id из команд присутствует в БД, но отсутствует в папочной структуре

      if (!listValueDataLinkId.has(idSetFromCommandResult)) {
          const existingConnection = await deep.select({ id: idSetFromCommandResult });
          if (existingConnection.data.length > 0) {
              await deep.delete({ id: idSetFromCommandResult });
              console.log(`Удалена связь с id ${idSetFromCommandResult}, так как она отсутствует в папочной структуре.`);
          }
      }
    }
  }
};






const processResult = async (resultData, data, currentDir) => {
  // Если это подписка, используем полученный resultData
  if (resultData && typeof resultData.subscribe === 'function') {
      const subscriptionResult = await handleSubscriptionIn(resultData, currentDir, data);
      return
  }

  // console.log(resultData, 'Финальный resultData[0] перед проверкой return');
  resultData = [resultData]
  // Проверяем return
  if (resultData[0].return !== undefined) {
      await selectRelation(resultData, currentDir);
  } else {
      await selectSimple(resultData, currentDir); 
  }
};







const selectSimple = async (resultData, currentDir, subName = null) => {
  const linkList = resultData[0].data || resultData[0]; // Получаем список связей

  if (subName != null) await subClean(currentDir, linkList, subName); // Используем номер подписки
  
  for (const link of linkList) {
      const nameLink = await getLinkName(link.id);
      
      // Формируем имя папки в зависимости от наличия subName
      const newLinkDir = subName !== null 
          ? (nameLink ? `${link.id}__${nameLink}__${link.type_id}--${subName}` : `${link.id}__${link.type_id}--${subName}`)
          : (nameLink ? `${link.id}__${nameLink}__${link.type_id}` : `${link.id}__${link.type_id}`);

      // Создаем директорию, если её еще нет
      await createDirectory(path.join(currentDir, newLinkDir));
      await createValueFile(link, path.join(currentDir, newLinkDir));
      await createDataFile(link, path.join(currentDir, newLinkDir));
  }
};







const handleSubscriptionIn = async (subscription, currentDir, data) => {
    const subscriptionData = await saveSubscriptionData(data, currentDir, 'In');
    
    if (subscriptionData.filePath) {
        const subscriptionHandler = subscription.subscribe({
            next: async (links) => {
                const filteredLinks = Object.values(links).filter(link => link !== undefined);
                console.log('Получены новые данные подписки:', links);

                const returnValue = links.return; 
                
                const resultData = {
                    '0': {
                        data: filteredLinks,
                        return: returnValue 
                    }
                };
                
              if (resultData[0].return !== undefined) {
                await selectRelation(resultData, currentDir, subscriptionData.folderName);
              } else {
                await selectSimple(resultData, currentDir, subscriptionData.folderName); // Передаем subName
              }
            },
            error: (error) => {
                console.error('Ошибка подписки:', error);
                resolve(); // Решаем промис в случае ошибки
            },
        });

        // Для обработки отмены подписки
        fs.watchFile(subscriptionData.filePath, (curr, prev) => {
            if (!fs.existsSync(subscriptionData.filePath)) {
                console.log('Файл подписки удален. Отписываемся...');
                subscriptionHandler.unsubscribe();
                fs.unwatchFile(subscriptionData.filePath);
            }
        });
    } else {
        console.error('Ошибка сохранения данных подписки');
        resolve(); // Возвращаем resolve если возникла ошибка
    }
};




const subClean = async (currentDir, linkList, subName) => {
  const existingDirs = fs.readdirSync(currentDir)
      .filter(file => fs.statSync(path.join(currentDir, file)).isDirectory() && file.endsWith(`--${subName}`));


  const existingLinkIds = new Set(linkList.map(link => link.id));
  for (const dir of existingDirs) {
    const dirIdMatch = dir.match(/^(\d+)/); 

    if (dirIdMatch) {
      let dirId = dirIdMatch[1]; 
      dirId = Number(dirId)


      if (!existingLinkIds.has(dirId)) {
          console.log(`Удаляем папку: ${dir}`);
          fs.rmdirSync(path.join(currentDir, dir), { recursive: true });
      } else {
          //let nameLink = await getLinkName(dirId);
          console.log(dirId, 'dirId')
          let nameLink = await deep.select({
            type_id: 3,
            to_id: dirId,
          });
          if (nameLink.data.length > 0) {
            if(nameLink.data[0].value == null) nameLink = undefined
            else nameLink = nameLink.data[0].value.value;
          } else{
            nameLink = undefined
          }
          const linkType = linkList.find(link => link.id === dirId).type_id;

          const expectedDirName = nameLink ? 
              `${dirId}__${nameLink}__${linkType}--${subName}` : 
              `${dirId}__${linkType}--${subName}`;


          if (dir !== expectedDirName) {
              const newDirPath = path.join(currentDir, expectedDirName);
              console.log(`Переименовываем папку: ${dir} в ${expectedDirName}`);
              fs.renameSync(path.join(currentDir, dir), newDirPath);
          }
      }
    }
  }
};


 




// Проверка и обновление значений в зависимости от отношений
const updateDataFromRelations = async (dirPath) => {
  let data;
   try {
      const dataJsonPath = path.join(dirPath, 'data.json');
      data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf-8'));
      let typesUpdate = false;
      let typeUpdate2 = false;
      let typeUpdate = false;
      if (!fs.existsSync(dataJsonPath)) {
        console.log("data.json не найден в директории " + dirPath);
        return;
      }
    
      let updated = false; // отслеживание обновлений
    
      // Проверка текущей директории для отработки from, to, type
      const currentRelationDirs = ['from', 'to', 'type'];
    
      for (const relation of currentRelationDirs) {
        const currentRelationPath = path.join(path.dirname(path.dirname(dirPath)), relation);
    
        if (fs.existsSync(currentRelationPath) && fs.statSync(currentRelationPath).isDirectory()) {
    
          const subDataJsonPath = path.join(path.dirname(path.dirname(dirPath)), 'data.json');
          if (fs.existsSync(subDataJsonPath)) {
            const relationData = JSON.parse(fs.readFileSync(subDataJsonPath, 'utf-8'));
            dirPath = path.dirname(path.dirname(dirPath))
            const relationId = data.id;
            data = relationData
    
            // Обновляем значения в зависимости от найденного идентификатора
            if (relationId && !isNaN(relationId)) {
              if (relation === 'from') {
                if (data.from_id !== relationId) {
                  data.from_id = relationId;
                  updated = true; // Значение обновлено
                }
              }
              if (relation === 'to') {
                if (data.to_id !== relationId) {
                  data.to_id = relationId;
                  updated = true; // Значение обновлено
                }
              }
              if (relation === 'type') {
               typeUpdate2 = true;
                if (data.type_id !== relationId) {
                  typeUpdate = relationId;
                  updated = true; // Значение обновлено
                }
              }
            }
          }
        }
      }
    
      if(typeUpdate){
        dirPath = await renameFolder(dirPath, typeUpdate, 'type');
      }
    
      // Записываем изменения обратно в data.json только если данные изменились
      if (updated) {
        updateDataJson(dirPath, data);
      }
    
      // Проверка родительских директорий на наличие relations: in, out, types
      const parentDir = path.dirname(dirPath);
      const relationDirs = ['in', 'out', 'types'];
    
      for (const relation of relationDirs) {
        const parentRelationPath = path.join(path.dirname(parentDir), relation);
        if (fs.existsSync(parentRelationPath) && fs.statSync(parentRelationPath).isDirectory()) {
    
          const subDataJsonPath = path.join(path.dirname(parentDir), 'data.json');
          if (fs.existsSync(dataJsonPath)) {
            const relationData = JSON.parse(fs.readFileSync(subDataJsonPath, 'utf-8'));
            const relationId = relationData.id;
    
            // Обновляем данные в зависимости от найденного идентификатора
            if (relationId && !isNaN(relationId)) {
              if (relation === 'in') {
                if (data.to_id !== relationId) {
                  data.to_id = relationId;
                  updated = true; // Значение обновлено
                }
              }
              if (relation === 'out') {
                if (data.from_id !== relationId) {
                  data.from_id = relationId;
                  updated = true; // Значение обновлено
                }
              }
              if (relation === 'types') {
                if (data.type_id !== relationId && !typeUpdate) {
                  if(!fs.existsSync(path.join(dirPath, 'type'))){
                     typesUpdate = relationId;
                     // updated = true; // Значение обновлено
                  }
                }
              }
            }
          }
        }
      }
    
      //console.log(typeUpdate2, 'typeUpdate2')
      if(typesUpdate){
        dirPath = await renameFolder(dirPath, typesUpdate, 'type');
      }
    
      // Записываем изменения обратно в data.json только если данные изменились
      if (updated) {
        updateDataJson(dirPath, data);
      }
   } catch (err) {
     console.error(`Ошибка при обновлении данных в директории ${dirPath}:`, err);
     const errorFilePath = path.join(dirPath, 'error.txt');
     fs.writeFileSync(errorFilePath, `Ошибка при обновлении данных: ${err.message}`);
   }
 };



// Обработка изменений
const processChanges = (dirPath) => {
   try {
     // Сначала синхронизируем значения в data.json с именем папки
     syncFolderNamesWithIds(dirPath);
 
     // Обновляем данные на основе других папок
     const dataJsonPath = path.join(dirPath, 'data.json');
     if (fs.existsSync(dataJsonPath)) {
       let data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
       updateDataFromRelations(dirPath, data);
     }
   } catch (err) {
     console.error(`Ошибка при обработке изменений в директории ${dirPath}:`, err);
     const errorFilePath = path.join(dirPath, 'error.txt');
     fs.writeFileSync(errorFilePath, `Ошибка при обработке изменений: ${err.message}`);
   }
 };



// Настройка наблюдателя на изменения
const watcher = chokidar.watch(dirPath, { persistent: true });



watcher.on('rename', (oldPath, newPath) => {
   try {
      setTimeout(() => processChanges(path.dirname(newPath)), 100);
   } catch (err) {
     console.error(`Ошибка при обработке переименования директории ${oldPath}:`, err);
     const errorFilePath = path.join(path.dirname(oldPath), 'error.txt');
     fs.writeFileSync(errorFilePath, `Ошибка при обработке переименования директории: ${err.message}`);
   }
 }).on('addDir', path1 => {
   try {
      if (!path.basename(path1).startsWith(".")) {
         //console.log("Папка добавлена: " + path1);
         setTimeout(() => processChanges(path1), 100);
     }
   } catch (err) {
     console.error(`Ошибка при обработке добавления директории ${path1}:`, err);
     const errorFilePath = path.join(path1, 'error.txt');
     fs.writeFileSync(errorFilePath, `Ошибка при обработке добавления директории: ${err.message}`);
   }
 }).on('change', path1 => {
   try {
      if (!path.basename(path1).startsWith(".") && !path.basename(path1).includes('data.json')) {
         console.log("Изменение: " + path1);
         setTimeout(() => processChanges(path.dirname(path1)), 100);
  
         // Обработка изменения value.txt
         if (path.basename(path1) === 'value.txt') {
             const currentDir = path.dirname(path1);
             const dataJsonPath = path.join(currentDir, 'data.json');
             if (fs.existsSync(dataJsonPath)) {
                 const data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
                 if (data.value != undefined || data.value != null) {
                    if (data.value.value) {
                       const newValue = fs.readFileSync(path1, 'utf8').trim();
                       data.value.value = newValue;
                       updateDataJson(currentDir, data);
                    }
                 }
             }
         }
  
         // Сохранение содержимого eval.js при изменении
         if (path.basename(path1) === 'eval.js') {
             const evalPath = path1;
             evalData[evalPath] = fs.readFileSync(evalPath, 'utf8');
         }
     }
   } catch (err) {
     console.error(`Ошибка при обработке изменения файла ${path1}:`, err);
     const errorFilePath = path.join(path.dirname(path1), 'error.txt');
     fs.writeFileSync(errorFilePath, `Ошибка при обработке изменения файла: ${err.message}`);
   }
 }).on('unlink', path1 => {
   try {
      if (path.basename(path1) === 'eval.js') {
         const currentDir = path.dirname(path1);
         const evalPath = path1;
         if (evalData[evalPath]) {
             fs.promises.writeFile(evalPath, evalData[evalPath])
                 .then(() => {
                     executeEvalFile(evalPath, currentDir);
                 })
                 .catch(error => {
                     console.error('Ошибка восстановления eval.js:', error);
                 });
         }
     }
   } catch (err) {
     console.error(`Ошибка при обработке удаления файла ${path1}:`, err);
     const errorFilePath = path.join(path.dirname(path1), 'error.txt');
     fs.writeFileSync(errorFilePath, `Ошибка при обработке удаления файла: ${err.message}`);
   }
 }).on('error', error => {
   console.error("Ошибка с наблюдателем:", error);
   const errorFilePath = path.join(dirPath, 'error.txt');
   fs.writeFileSync(errorFilePath, `Ошибка с наблюдателем: ${error.message}`);
 });
// ...

// Обработка существующих директорий при старте
const initialScan = (dirPath) => {
   if (fs.existsSync(dirPath)) {
     try {
       const subDirs = fs.readdirSync(dirPath).filter(name => fs.statSync(path.join(dirPath, name)).isDirectory());
       for (const subDir of subDirs) {
         const subDirPath = path.join(dirPath, subDir);
         processChanges(subDirPath);
         if (fs.existsSync(subDirPath)) {
           initialScan(subDirPath);
         }
       }
     } catch (err) {
       console.error(`Ошибка при сканировании директории ${dirPath}:`, err);
     }
   }
 };
 

 

// Начальный обход существующих директорий
initialScan(dirPath);
console.log("Наблюдатель запущен. Отслеживание изменений...");
