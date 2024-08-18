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
const createFile = async (filePath, content = '') => {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, content, { flag: 'w' });
    }
}
const createDirectory = async (directoryPath) => {
   if (!fs.existsSync(directoryPath)) {
       fs.mkdirSync(directoryPath, { recursive: true });
   };

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
  console.log(link, 'link0000')
  if(typeof link != 'object') link = await deep.select({id: link})
  else link = await deep.select({id: link.id})

  let fileContentString = JSON.stringify(link.data[0]);
  console.log(fileContentString, 'fileContentString1111')
  if(fileContentString["data"]) fileContentString = fileContentString["data"][0]
  console.log(fileContentString, 'fileContentString2222')
  fs.writeFile(filedir, fileContentString, (err) => {
    if (err) {
      console.error("Ошибка записи в файл:", err);
      return;
    }
    console.log('Файл успешно обновлен на !', fileContentString);
  });
}


const renameFolder = async (filedir, link) => {
  console.log(filedir, 'filedir')
  try {
    console.log(`поиск в {link}`);
    console.log(link)
    if(typeof link != 'object') link = await deep.select({id: link})
    else link = await deep.select({id: link.id})
    console.log(link, 'link2222')
    const name = await getLinkName(link.data[0].id)
    console.log(`название в ${name}`);
    let newFolderName = name
      ? `${link.data[0].id}__${name}__${link.data[0].type_id}`
      : `${link.data[0].id}__${link.data[0].type_id}`;

    const newFolderPath = path.join(path.dirname(filedir), newFolderName);

    await fs.promises.rename(filedir, newFolderPath);
    console.log(`Папка успешно переименована в ${newFolderName}`);
  } catch (err) {
    console.error("Ошибка при переименовании папки:", err);
  }
}


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

// Функция для сохранения данных подписки в файл
const saveSubscriptionData = async (data, currentDir, type) => {
  const subFileName = `sub${type}${Date.now()}.json`; // Уникальное имя файла на основе времени
  const subFilePath = path.join(currentDir, subFileName);
  try {
      fs.writeFileSync(subFilePath, JSON.stringify(data, null, 2));
      console.log(`Сохранено значение подписки в файл ${subFileName}`);
      return {
          filePath: subFilePath,
          folderName: subFileName.replace('.json', '') // Возвращаем имя папки без формата
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
          // Проверка, является ли содержимое объектом
          let parsedData;
          try {
              console.log(data, 'data')
              parsedData = JSON.parse(data);
              console.log(parsedData, 'parsedData')
          } catch (parseError) {
              // Если не удалось парсить как объект, выполняем как обычно
              console.warn('Содержимое не является объектом, выполняем как обычный код.');
              const result = await executeAsync(data);
              console.log('результат поиска', result)
              await processResult(result, data, currentDir);
              return;
          }

          // Проверка типа запроса
          if (typeof parsedData === 'object' && parsedData !== null) {
              if (parsedData.mode === 'req') {
                await handleRequest(parsedData, currentDir)
              } 
              else if (parsedData.mode === 'sub') {
                await handleSubscriptionOut(parsedData, currentDir);
                

              }
              else {
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
  let commandResults = [];
  let straightPathData = [];
  let relationPathData = [];
  
  try {
    // Обработка команды, если есть
    if (parsedData.command) {
      commandResults = await executeAsync(parsedData.command);
      commandResults = commandResults.data; // Сохраняем данные результатов
    }



    if (parsedData.straightPath && parsedData.straightPath.length > 0) {
      straightPathData = await processPath(parsedData.straightPath, currentDir);

      if (commandResults) await commandStraightSync(commandResults, straightPathData);
      else await noCommandStraightSync(straightPathData, currentDir);
    }

    if (parsedData.relationPath && parsedData.relationPath.length > 0) {
      relationPathData = await processPath(parsedData.relationPath, currentDir, parsedData.command);
      let folderRequestResult;
      if (commandResults) {
        await checResultsWithCurrent(commandResults, relationPathData);
      }
      else {
        for(const folderRequest of relationPathData.queries){
          folderRequestResult = await executeAsync(folderRequest);
          await checResultsWithCurrent(folderRequestResult, relationPathData);
        }
      }
    }

  } catch (error) {
      console.error('Ошибка при выполнении команды:', error);
      await createFile(path.join(currentDir, 'error.txt'), `${error}`);
  }
};



const checResultsWithCurrent = async (folderRequestResult, relationPathData) => {
  // Функция processLinks обрабатывает сравнение и синхронизацию двух связей
  const processLinks = async (link1, link2) => {
    // Обрабатываем новые связи, которых нет в link1, но есть в link2
    await processNewLinks(link2.filter((link) => !link1.find((result) => result.id === link.id)));
    // Обрабатываем удаление связей, которые есть в link1, но отсутствуют в link2
    await processRemoval(link1, link2);

    // Оставляем только те связи в link1, которые есть и в link2
    link1 = link1.filter((link) => link2.find((result) => result.id === link.id));

    // Проходим по каждому ключу в link1 и сравниваем его с соответствующим значением в link2
    for (const key of Object.keys(link1)) {
      if (link1[key] !== link2[key]) {
        if (typeof link1[key] !== 'object') {
          // Если значение простое (не объект), обновляем его
          await deep.update({ link_id: link1.id }, { [key]: link1[key] });
        } else if (key === 'value' && typeof link1[key] === 'object') {
          // Если значение — объект и ключ "value", обрабатываем отдельно
          await deep.update({ link_id: link1.id }, { value: link1[key] }, { table: (typeof link1[key]) + 's' });
        } else {
          // Если значение — объект (или массив объектов), углубляемся
          const link1Value = Array.isArray(link1[key]) ? link1[key] : [link1[key]];
          const link2Value = Array.isArray(link2[key]) ? link2[key] : [link2[key]];

          // Рекурсивно вызываем processLinks для обработки вложенных объектов
          for (let i = 0; i < link1Value.length; i++) {
            if (link2Value[i]) {
              await processLinks(link1Value[i], link2Value[i]);
            } else {
              const data = {
                from_id: link1Value[i].from_id,
                type_id: link1Value[i].type_id,
                to_id: link1Value[i].to_id,
              };

              if (link1Value[i].value) {
                data.string = { data: { value: link1Value[i].value.value } }
              }

              await deep.insert(data);
            }
          }
        }
      }
    }
  };

  // Обрабатываем новые связи, которые есть в link2, но отсутствуют в link1
  const processNewLinks = async (newLinks) => {
    for (const newLink of newLinks) {
      const existingLink = await deep.select({ id: newLink.id });
      if (!existingLink) {
        const data = {
          from_id: newLink.from_id,
          type_id: newLink.type_id,
          to_id: newLink.to_id,
        };

        if (newLink.value) {
          data.string = { data: { value: newLink.value.value } }
        }

        await deep.insert(data);
      } else {
        await deep.update(
          { link_id: newLink._id },
          { from_id: newLink.from_id },
          { type_id: newLink.type_id },
          { to_id: newLink.to_id },
          { value: newLink.value?.value },
          { table: (typeof newLink.value?.value) + 's' }
        );
      }
    }
  };

  // Обрабатываем удаление связей, которые есть в link1, но отсутствуют в link2
  const processRemoval = async (link1, link2) => {
    for (const link of link1) {
      if (!link2.find((result) => result.id === link.id)) {
        await deep.delete({ id: link.id });
      }
    }
  };

  // 1. Начинаем с обработки корневого уровня. Проходим по каждому объекту в folderRequestResult.
  for (const existingLink of folderRequestResult) {
    const relationPathDataLink = relationPathData.results.find((result) => result.id === existingLink.id);
    if (relationPathDataLink) {
      // Если нашли совпадающий объект в relationPathData, обрабатываем их сравнением.
      await processLinks(existingLink, relationPathDataLink);
    } else {
      // Если объект отсутствует в relationPathData, добавляем его в базу.
      await processNewLinks([existingLink]);
    }
  }

  // 2. Дополнительно обрабатываем удаление связей, которые есть в relationPathData, но отсутствуют в folderRequestResult.
  const linksToRemove = relationPathData.results.filter((result) => !folderRequestResult.find((link) => link.id === result.id));
  await processRemoval(linksToRemove, relationPathData.results);

  // 3. Сравниваем и обновляем названия связей, если это необходимо.
  for (const id in relationPathData.listNameLink) {
    if (relationPathData.listNameLink[id]) {
      const linkName = await getLinkName(id);
      if (linkName !== relationPathData.listNameLink[id]) {
        await deep.update(
          { link_id: id },
          { value: relationPathData.listNameLink[id] },
          { table: 'strings' }
        );
      }
    }
  }
};
 


const processPath = async (straightPath, currentDir, mode, commandRelation) => {
  console.log('Обработка straightPath:', straightPath);


  if(!commandRelation){}
  else if(commandRelation || commandRelation != null){}
  
  
  // Массив для хранения найденных значений
  const results = [];
  const listNameLink = {};
  const pathResults = [];
  let nameLink;
  let queries;
  for (const userPath of straightPath) {

    let cleanPath = userPath;

    if (userPath.startsWith('-')) {
      cleanPath = userPath.substring(1); 
    }
  
    // Удаляем тильду в конце строки
    if (userPath.endsWith('~')) {
      cleanPath = userPath.substring(0, userPath.length - 1); 
    }
    
    let absoluteCleanPath = path.join(currentDir, cleanPath);
  

    if(path.basename(absoluteCleanPath) === 'data.json' || path.basename(absoluteCleanPath) === 'data.json~'){
      absoluteCleanPath = path.dirname(absoluteCleanPath).split(path.sep).pop();
    }

    if (!fs.existsSync(absoluteCleanPath)) {

        const lastDirectory = path.basename(path.dirname(linkPath));

        // 3. Извлекаем первое значение, разделенное "__" в последней директории.
        const firstValue = lastDirectory.split('__')[0];

        // 4. Проверяем, существует ли папка с таким же первым значением в более внешней директории.
        const parentDirectory = path.dirname(path.dirname(linkPath));
        absoluteCleanPath = fs.readdirSync(parentDirectory).find(folder => folder.startsWith(`${firstValue}__`));  
      }


    if (fs.existsSync(absoluteCleanPath)) {
      const files = fs.readdirSync(absoluteCleanPath);
      const hasRelationFiles = files.includes('data.json') && files.includes('value.txt');
      // если папка - папка-связь
      if (hasRelationFiles) {
        // Папка-связь — обрабатываем файл data.json
        const dataFilePath = path.join(absoluteCleanPath, 'data.json');
        const folderName = path.basename(absoluteCleanPath);
        let data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
        data = {...data}
        if(data.data) data = data.data[0]
      
        if(userPath.startsWith("-")){
          await deep.delete({id:data.id})
          continue;
        }

        if(mode == 'straight'){
          // Читаем значение из value.txt
          let value = fs.readFileSync(path.join(absoluteCleanPath, 'value.txt'), 'utf-8')
          if(value == 'null') value = null
          if(data.value || data.value != null) {
            if(data.value.value != value) data.value.value = value;
          }

          // Получаем имя ссылки 
          if(folderName.split('__').length >= 3) nameLink = folderName.split('__')[1];
          else nameLink = await getLinkName(data.id);

          listNameLink[data.id] = nameLink
          pathResults.push({ id: data.id, path: absoluteCleanPath });
          results.push(data);
        }
        else if(mode == 'relation'){
          const pathParts = absoluteCleanPath.split(path.sep);
          for (let i = pathParts.length - 1; i >= 0; i--) {
            const currentDir = pathParts.slice(0, i + 1).join(path.sep);
            if (fs.existsSync(path.join(currentDir, 'data.json'))) {
              const dataFilePath = path.join(currentDir, 'data.json');
              const folderName = path.basename(currentDir);
              let data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
              data = {...data}
              if(data.data) data = data.data[0]
              const id = data.id;
              if (!nameLink && folderName.split('__').length >= 3) nameLink = folderName.split('__')[1];
              else nameLink = await getLinkName(id);

              listNameLink[data.id] = nameLink;
              break;
            }
          }
          
          pathResults.push({ id: data.id, path: absoluteCleanPath });
          data = await pathToObjResultAndSelect(absoluteCleanPath, data)
          queries = data.queries
          data = data.result
          //results.push(data);
        }
        console.log('Обработаны данные связи из папки:', data);
      } 
      // если нужны все папки внутри только этой директории
      else if(userPath.endsWith("~")){
        // Папка, нужная для поиска связанных папок — рекурсивно обрабатываем ее
        const linkDirs = files.filter(file => fs.statSync(path.join(absoluteCleanPath, file)).isDirectory());

        for (const linkDir of linkDirs) {
          const dataFilePath = path.join(linkDir, 'data.json');
          const folderName = path.basename(linkDir);
          let data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
          data = {...data}
          if(data.data) data = data.data[0]
        

          if(userPath.startsWith("-")){
            await deep.delete({id:data.id})
            continue;
          }
          

          if(mode == 'straight'){
            // Читаем значение из value.txt
            let value = fs.readFileSync(path.join(linkDir, 'value.txt'), 'utf-8')
            if(value == 'null') value = null
            if(data.value || data.value != null) {
              if(data.value.value != value) data.value.value = value;
            }

            // Получаем имя ссылки 
            if(folderName.split('__').length >= 3) nameLink = folderName.split('__')[1];
            else nameLink = await getLinkName(data.id);



            listNameLink[data.id] = nameLink
            pathResults.push({ id: data.id, path: linkDir });
            results.push(data);
          }
          else if(mode == 'relation'){
            const pathParts = absoluteCleanPath.split(path.sep);
            for (let i = pathParts.length - 1; i >= 0; i--) {
              const currentDir = pathParts.slice(0, i + 1).join(path.sep);
              if (fs.existsSync(path.join(currentDir, 'data.json'))) {
                const dataFilePath = path.join(currentDir, 'data.json');
                const folderName = path.basename(currentDir);
                let data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
                data = {...data}
                if(data.data) data = data.data[0]
                const id = data.id;
                if (!nameLink && folderName.split('__').length >= 3) nameLink = folderName.split('__')[1];
                else nameLink = await getLinkName(id);

                listNameLink[data.id] = nameLink;
                break;
              }
            }


            pathResults.push({ id: data.id, path: linkDir });
            data = await pathToObjResultAndSelect(linkDir, data)
            queries = data.queries
            data = data.result
          }

          console.log('Обработаны данные связи из папки:', data);
        }
      }

      // пробуем поиск по релейшену
      else{
        // Папка, нужная для поиска связанных папок — рекурсивно обрабатываем ее
        const linkDirs = files.filter(file => fs.statSync(path.join(absoluteCleanPath, file)).isDirectory());

        for (const linkDir of linkDirs) {
          
          const linkDirPath = path.join(absoluteCleanPath, linkDir);
          // Запускаем рекурсивный вызов и собираем результаты
          const linkResults = await processPath([linkDirPath], currentDir);

      
          if(mode == 'straight'){
            results.push(...linkResults.results); // Делаем "распаковку" массива
            pathResults.push(...linkResults.pathResults); // Делаем "распаковку"массива
            Object.assign(listNameLink, linkResults.listNameLink); // Объединяем списки имен ссылок
          }
          else if(mode == 'relation'){
            data = {...linkResults.results}
            data = await pathToObjResultAndSelect(linkDir, data)
            queries = data.queries
            data = data.result
            //results.push(data); 
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




const pathToObjResultAndSelect = async (folderPath, data, relations = {}) => {

  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    console.error('Invalid current directory');
    return { result: data, queries: [] };
  }

  const segments = folderPath.split(path.sep);
  let currentObject = data;
  let foundData = false;
  let relationsPath = relations;
  let query = {};
  let queries = [];

  for (let i = 0; i < segments.length; i++) {
    let pathSoFar = '';
    for (let j = 0; j <= i; j++) {
      pathSoFar = path.join(pathSoFar, segments[j]);
    }

    if (fs.existsSync(pathSoFar) && fs.statSync(pathSoFar).isDirectory()) {
      const dataFilePath = path.join(pathSoFar, 'data.json');

      if (fs.existsSync(dataFilePath)) {
        const newData = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));

        let relationName = segments[i] + 'Text';
        for (const key in relationsPath) {
          if (relationsPath[key].relation === segments[i]) {
            relationName = key;
            relationsPath = relationsPath[key].return;
            break;
          }
        }

        if (!currentObject.some(obj => obj.hasOwnProperty(relationName))) {
          currentObject.push({ [relationName]: newData });
        } else {
          const existingObject = currentObject.find(obj => obj.hasOwnProperty(relationName));
          Object.assign(existingObject[relationName], newData);
        }

        currentObject = currentObject.find(obj => obj.hasOwnProperty(relationName))[relationName];

        if (!relations) {
          if (foundData) {
            let returnObj = query.return;
            for (let k = 1; k < i; k++) {
              returnObj = returnObj[Object.keys(returnObj)[0]].return;
            }
            let relationName = segments[i] + 'Text';
            returnObj[relationName] = { relation: segments[i], return: {} };
          } else {
            foundData = true;
            query.id = newData.id;
            query.return = {};
            let relationName = segments[i] + 'Text';
            query.return[relationName] = { relation: segments[i], return: {} };
          }
        }

      } else {
        if (!foundData) { // Пропускаем каталог, если не нашли data.json
          continue; 
        } else {
          let relationName = segments[i] + 'Text';
          for (const key in relationsPath) {
            if (relationsPath[key].relation === segments[i]) {
              relationName = key;
              relationsPath = relationsPath[key].return;
              break;
            }
          }

          if (!currentObject.some(obj => obj.hasOwnProperty(relationName))) {
            currentObject.push({ [relationName]: [] });
          }

          currentObject = currentObject.find(obj => obj.hasOwnProperty(relationName))[relationName];

          if (!relations) {
            let returnObj = query.return;
            for (let k = 1; k < i; k++) {
              returnObj = returnObj[Object.keys(returnObj)[0]].return;
            }
            returnObj[relationName] = { relation: segments[i], return: {} };
          }
        }
      }
    }
  }

  // Сохраняем запрос в список запросов
  if (!relations && !queries.some(q => JSON.stringify(q) === JSON.stringify(query))) {
    queries.push(query);
  }

  if (!foundData) currentObject = [];
  return { result: data, queries: queries };
}



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

      let updatesTo = {};
      let updatesType = {};
      let updatesFrom = {};
      let updatesValue1 = {};
      let updatesValue2 = {};
      // Проверяем и обновляем name
      if (nameFolderLink != nameLink) {
        const test = await deep.select({ id: { type_id: 3, to: { id: linkId } } });
        console.log(test, 'testssss');

        const contain = await deep.select({ type_id: 3, to: { id: linkId } })  // нужно что-то придмать с тем, чтобы это работало и в пустых контейнах. сейчас он изменяет содержимое только если оно уже есть
        await deep.update(
          { link_id: contain.data[0].id },
          { value: nameFolderLink },
          { table: (typeof nameFolderLink) + 's' }
        );      
        
        console.log(`Обновлена связь ${linkId}`);
      }
      if (existingLink.to_id !== linkFolder.to_id){
          updatesTo = { to_id: linkFolder.to_id };
      }
      if (existingLink.from_id !== linkFolder.from_id){
        updatesFrom = {from_id: linkFolder.from_id};
      }
      if (existingLink.type_id !== linkFolder.type_id){
        updatesType = {type_id: linkFolder.type_id};
        await renameFolder(linkPath.path, linkId)
        }
      if ((existingLink.value !== linkFolder.value) && existingLink.value != null) {
        if(linkFolder.value != null || linkFolder.value != undefined){
          updatesValue1 = { value: linkFolder.value.value};
          updatesValue2 = { table: (typeof linkFolder.value.value) + 's' };
        } else{
          updatesValue1 = { value: " "};
          updatesValue2 = { table: 'strings' };
        }
      }     
        console.log(`Обновлена связь с id ${linkId} на`);
        console.log(updatesTo, updatesFrom, updatesType, updatesValue1, updatesValue2)
        await deep.update( 
          updatesValue1,
          updatesFrom,
          updatesTo,
          updatesType,
          {link_id: linkId },
          updatesValue2,
          ); 
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
          
              if (commandResult.to_id !== straightPathResult.to_id)
                updatesTo = { to_id: straightPathResult.to_id };
              if (commandResult.from_id !== straightPathResult.from_id)
                updatesFrom = {from_id: straightPathResult.from_id};
              if (commandResult.type_id !== straightPathResult.type_id)
                updatesType = {type_id: straightPathResult.type_id};
              if (commandResult.value !== straightPathResult.value) {
                if((straightPathResult.value != null || straightPathResult.value != undefined )&& straightPathResult.value != null){
                  if (commandResult.value.value !== straightPathResult.value.value) {
                    updatesValue1 = { value: straightPathResult.value.value};
                    updatesValue2 = { table: (typeof straightPathResult.value.value) + 's' };
                  } else{
                    updatesValue1 = { value: " "};
                    updatesValue2 = { table: 'strings' };
                  }
                }
            }    
            await deep.update( 
              updatesFrom,
              updatesTo,
              updatesType,
              updatesValue1,
              {link_id: originalId },
              updatesValue2,
              );      
            console.log(`Обновлена связь с id ${originalId} на`);
            console.log(updatesTo, updatesFrom, updatesType, updatesValue1, updatesValue2)
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

  console.log(resultData, 'Финальный resultData[0] перед проверкой return');
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



// Функция для обработки подписки и настройки наблюдателей
const handleSubscriptionOut = async (data, currentDir) => {
  // Сохранение данных подписки в файл
  const subscriptionData = await saveSubscriptionData(data, currentDir, 'Out');
  
  // Если данные успешно сохранены, настраиваем наблюдателей
  if (subscriptionData.filePath) {
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
  } else {
      console.error('Ошибка сохранения данных подписки');
  }
};



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
            await createFile(evalPath, evalData[evalPath]);
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
    if (f.endsWith('value.txt')) {
      try {
        const newValue = fs.readFileSync(f, 'utf8').trim(); // Считываем новое значение из value.txt
        const dataPath = path.join(currentDir, 'data.json');

        if (fs.existsSync(dataPath)) {
          // Если файл data.json существует, заменяем значение
          const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

          // Предполагается, что в data.json есть объект с полем value
          if (data.value !== undefined || data.value !== null) {
            data.value = newValue; // Заменяем значение
            fs.writeFileSync(dataPath, JSON.stringify(data, null, 2)); // Записываем обратно в data.json
            console.log(`Значение в data.json обновлено на: ${newValue} в директории ${currentDir}`);
          }
        } else {
          console.log(`data.json не найден в директории ${currentDir}`);
        }
      } catch (error) {
        console.error(`Ошибка обработки value.txt в ${currentDir}: ${error}`);
      }
    }

    // Проверка изменений в структуре папок
    await updateJsonBasedOnFolderChanges(currentDir);
  }
});

// Функция для чтения файла
const fileread = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error('Ошибка чтения:', filePath, err);
        reject(err);
        return;
      }
      resolve(data);
    });
  });
};

// Функция для обновления data.json на основе изменений в других файлах или папках
const updateJsonBasedOnFolderChanges = async (currentDir) => {
  try {
    const dataPath = path.join(currentDir, 'data.json');
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

      // Проверка внешних директорий для in, out, typed
      const externalDirs = ['in', 'out', 'typed'];
      const parentDir = path.dirname(currentDir);
      externalDirs.forEach(dir => {
        const dirPath = path.join(parentDir, dir);
        if (fs.existsSync(dirPath)) {
          const parentDirName = path.basename(parentDir);
          data[dir] = parentDirName;
          console.log(`Значение ${dir} в data.json обновлено на: ${parentDirName} в директории ${currentDir}`);
        }
      });

      // Проверка внутренних директорий для from, to, type
      const internalDirs = ['from', 'to', 'type'];
      internalDirs.forEach(dir => {
        const dirPath = path.join(currentDir, dir);
        if (fs.existsSync(dirPath)) {
          const parentDirName = path.basename(currentDir);
          data[dir] = parentDirName;
          console.log(`Значение ${dir} в data.json обновлено на: ${parentDirName} в директории ${currentDir}`);
        }
      });

      // Записываем изменения обратно в data.json
      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    } else {
      console.log(`data.json не найден в директории ${currentDir}`);
    }
  } catch (error) {
    console.error(`Ошибка обновления data.json на основе изменений в папках: ${error}`);
  }
};

// Запуск наблюдателя
watch.watchTree(dirPath, async (f, curr, prev) => {
  if (typeof f === 'object' && prev === null && curr === null) {
    return;
  } else {
    const currentDir = path.dirname(f);
    await updateJsonBasedOnFolderChanges(currentDir);
  }
});

