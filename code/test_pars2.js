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

let evalData = {}; // Объект для хранения данных удаленных файлов
let subscriptionCount = 0;

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

const createValueFile = (link, directoryPath) => {
    const valueFilePath = path.join(directoryPath, 'value.txt');

    // Получаем значение из объекта связи
    const valueContent = link.value !== null ? JSON.stringify(link.value.value) : 'null';

    // Создаем файл value.txt и записываем в него значение
    fs.writeFileSync(valueFilePath, valueContent, { flag: 'w' });
    console.log(`Создан файл ${valueFilePath} с содержимым: ${valueContent}`);
};

const createDataFile = (link, directoryPath) => {
    const dataFilePath = path.join(directoryPath, 'data.json');

    // Создаем файл data.json и записываем в него значение
    fs.writeFileSync(dataFilePath, JSON.stringify(link), { flag: 'w' });
    console.log(`Создан файл ${dataFilePath} с содержимым: ${link.value}`);
};


const selectRelation = async (arrayLink, baseDir) => {
    const idInFolder = getIdFromFolderName(baseDir);
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
            createDirectory(relationTypeDir);

            nameLink = await getLinkName(objLink.id);
            if (nameLink == undefined || nameLink == null) {
                linkDir = path.join(relationTypeDir, `${objLink.id}__${objLink.type_id}`);
            } else {
                linkDir = path.join(relationTypeDir, `${objLink.id}__"${nameLink}"__${objLink.type_id}`);
            }

            // Проверка существования папки
            if (!fs.existsSync(linkDir)) {
                createDirectory(linkDir);
            }

            createValueFile(objLink, linkDir);
            createDataFile(objLink, linkDir);
        } else {
            linkDir = baseDir;
        }

        await passingInLink(arrayLink[0].return, objLink, linkDir);
    }
};

const passingInReturn = (returnPath) => {
    let relationName = Object.keys(returnPath)[0];
    for (let key = 0; typeof returnPath[relationName] !== 'object'; key++) {
        relationName = Object.keys(returnPath)[key];
        if (Object.keys(returnPath).length <= key) return;
    }
 
    if (!returnPath[relationName]['relation']) {
        returnPath = returnPath[relationName];
        let data = passingInReturn(returnPath);
        let relationNewName = data[0];
        let relationOldName = data[1];
        returnPath = data[2];
        return [relationNewName, relationOldName, returnPath];
    }
 
    let relationNewName = returnPath[relationName]['relation'];
    let relationOldName = relationName;
    return [relationNewName, relationOldName, returnPath];
 };
const passingInLink = async (returnPath, arrayLink, baseDir) => {
    let data = passingInReturn(returnPath);
    let nameLink;
    let newLinkDir;
    if (data === undefined) return;

    let relationNewName = data[0];
    let relationOldName = data[1];
    let returnNewPath = data[2];

    let newDir = path.join(baseDir, relationNewName);
    createDirectory(newDir); 

    if (typeof arrayLink === 'object') arrayLink = arrayLink[relationOldName];

    for (let i = 0; arrayLink.length > i; i++) {
        nameLink = await getLinkName(arrayLink[i].id);
        if (nameLink == undefined || nameLink == null) {
            newLinkDir = path.join(newDir, `${arrayLink[i].id}__${arrayLink[i].type_id}`);
        } else {
            newLinkDir = path.join(newDir, `${arrayLink[i].id}__"${nameLink}"__${arrayLink[i].type_id}`);
        }

        // Проверка существования папки
        if (!fs.existsSync(newLinkDir)) {
            createDirectory(newLinkDir);
        }
        
        createValueFile(arrayLink[i], newLinkDir);
        createDataFile(arrayLink[i], newLinkDir);

        await passingInLink(returnNewPath[relationOldName], arrayLink[i], newLinkDir);
    }
};






const saveSubscriptionData = async (data, currentDir) => {
  const subFileName = `sub${subscriptionCount}.js`; // Уникальное имя файла
  const subFilePath = path.join(currentDir, subFileName);
  try {
      createFile(subFilePath, data);
      console.log(`Сохранено значение подписки в файл ${subFileName}`);
      subscriptionCount++; // Увеличиваем счетчик для следующего файла
      return {
          filePath: subFilePath,
          folderName: subFileName.replace('.js', '') // Возвращаем имя папки без формата
      };
  } catch (error) {
      console.error(`Ошибка сохранения данных подписки: ${error}`);
  }
};











// Функция для выполнения асинхронного кода
const executeAsync = async (code) => {
    return new Promise((resolve, reject) => {
        try {
            const func = async () => {
                return await eval(code);
            };
            resolve(func());
        } catch (err) {
            reject(err);
        }
    });
};


const executeEvalFile = async (evalPath, currentDir) => {
    fs.readFile(evalPath, 'utf8', async (err, data) => {
        if (err) {
            console.error('Ошибка чтения eval.js:', err);
            createFile(path.join(currentDir, 'eval.js'));
            return;
        }
        try {
            const result = await executeAsync(data);
            // Теперь передаем результат в processResult, который сам проверяет, есть ли подписка
            await processResult(result, data, currentDir);
        } catch (error) {
            console.error('Ошибка при выполнении eval.js:', error);
            createFile(path.join(currentDir, 'eval.js'));
        }
    });
};



const processResult = async (resultData, data, currentDir) => {
  console.log(resultData, 'resultData');

  let subName = null;

  // Если это подписка, используем полученный resultData
  if (resultData && typeof resultData.subscribe === 'function') {
      const subscriptionResult = await handleSubscription(resultData, currentDir, data);
      
      // console.log(subscriptionResult, 'subscriptionResult');

      // if (subscriptionResult) {
      //     const { folderName, resultData: subResultData } = subscriptionResult;
      //     subName = folderName; // Сохранение имени папки подписки

      //     // Обновляем resultData напрямую
      //     resultData = subResultData; // Получаем весь необходимый результат
      //     console.log(resultData, 'Обновленный resultData с фильтрованными данными'); 
      // }
      return
  }

  console.log(resultData, 'Финальный resultData[0] перед проверкой return');

  // Проверяем return
  if (resultData[0].return !== undefined) {
      await selectRelation(resultData, currentDir);
  } else {
      await selectSimple(resultData, currentDir); // Передаем subName
  }
};







const selectSimple = async (resultData, currentDir, subNum = null) => {
  const linkList = resultData[0].data || resultData[0]; // Получаем список связей

  if (subNum != null) {
    await subClean(currentDir, linkList, subNum); // Используем номер подписки
}
  for (const link of linkList) {
      const nameLink = await getLinkName(link.id);
      
      // Формируем имя папки в зависимости от наличия subNum
      const newLinkDir = subNum !== null 
          ? (nameLink ? `${link.id}__"${nameLink}"__${link.type_id}__${subNum}` : `${link.id}__${link.type_id}__${subNum}`)
          : (nameLink ? `${link.id}__"${nameLink}"__${link.type_id}` : `${link.id}__${link.type_id}`);
      console.log(newLinkDir, 'newLinkDir')
      console.log(link.id, 'link.id')
      console.log(link.type_id, 'link.type_id')
      console.log(nameLink, 'nameLink')

      // Создаем директорию, если её еще нет
      createDirectory(path.join(currentDir, newLinkDir));
      createValueFile(link, path.join(currentDir, newLinkDir));
      createDataFile(link, path.join(currentDir, newLinkDir));
  }


};







const handleSubscription = async (subscription, currentDir, data) => {
    const subscriptionData = await saveSubscriptionData(data, currentDir);
    
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
                await selectRelation(resultData, currentDir);
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




const subClean = async (currentDir, linkList, subNum) => {
  const existingDirs = fs.readdirSync(currentDir)
      .filter(file => fs.statSync(path.join(currentDir, file)).isDirectory() && file.endsWith(`__${subNum}`));


  const existingLinkIds = new Set(linkList.map(link => link.id));
  for (const dir of existingDirs) {
    const dirIdMatch = dir.match(/^(\d+)/); 

    if (dirIdMatch) {
      let dirId = dirIdMatch[1]; 
      dirId = Number(dirId)
      console.log(dirId, 'dirId', typeof dirId);
      console.log(existingLinkIds.has(dirId), 'existingLinkIds.has(dirId)');


      if (!existingLinkIds.has(dirId)) {
          console.log(`Удаляем папку: ${dir}`);
          fs.rmdirSync(path.join(currentDir, dir), { recursive: true });
      } else {
          const nameLink = await getLinkName(dirId);
          console.log(nameLink, 'nameLink9999')
          const linkType = linkList.find(link => link.id === dirId).type_id;

          const expectedDirName = nameLink ? 
              `${dirId}__"${nameLink}"__${linkType}__${subNum}` : 
              `${dirId}__${linkType}__${subNum}`;

          console.log(expectedDirName, 'expectedDirName9999')
          console.log(dir, 'dir9999')

          if (dir !== expectedDirName) {
              const newDirPath = path.join(currentDir, expectedDirName);
              console.log(`Переименовываем папку: ${dir} в ${expectedDirName}`);
              fs.renameSync(path.join(currentDir, dir), newDirPath);
          }
      }
    }
  }
};





// // Синхронизация ссылок и папок
// const syncLinks = async (incomingLinks, currentDir, subscriptionCount) => {
//     const existingDirs = fs.readdirSync(currentDir).filter(file => fs.statSync(path.join(currentDir, file)).isDirectory());
    
//     const incomingMap = new Map();
//     for (const link of incomingLinks) {
//         const nameLink = await getLinkName(link.id); // Получаем имя в асинхронном режиме
//         const linkName = nameLink !== undefined ? nameLink : `link_${link.id}`;
//         incomingMap.set(link.id, { ...link, name: linkName });
//     }

//     // Удаляем старые папки, которые отсутствуют в новых данных
//     existingDirs.forEach(dir => {
//         const id = dir.split('__')[0]; // Получаем ID из имени папки
//         if (!incomingMap.has(id)) {
//             console.log(`Удаляем папку ${dir}`);
//             fs.rmdirSync(path.join(currentDir, dir), { recursive: true });
//         }
//     });

//     // Обрабатываем новые или обновленные данные
//     for (const link of incomingMap.values()) {
//         const newLinkDirName = createSubscriptionDirectoryName(link.name, subscriptionCount); // Создаем новое имя папки
//         const newLinkDir = path.join(currentDir, newLinkDirName);
        
//         // Проверяем, существует ли папка уже
//         const existingDir = existingDirs.find(dir => dir.startsWith(link.id));
//         if (existingDir) {
//             // Если папка существует, обновляем файлы
//             console.log(`Обновляем содержимое в папке ${newLinkDir}`);
//             createValueFile(link, newLinkDir); // Обновляем value.txt
//             createDataFile(link, newLinkDir);   // Обновляем data.json
//         } else {
//             // Если папка не существует, создаем её
//             console.log(`Создаем папку ${newLinkDir}`);
//             createDirectory(newLinkDir);
//             createValueFile(link, newLinkDir); // Создаем value.txt
//             createDataFile(link, newLinkDir);   // Создаем data.json
//         }
//     }
// };





// Настройка наблюдателя за появлением и удалением файлов
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
  













