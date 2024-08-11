import pkg from '@apollo/client/core/core.cjs';
const { ApolloClient, InMemoryCache, split, HttpLink } = pkg;
import { DeepClient, parseJwt } from "@deep-foundation/deeplinks/imports/client.js";
import { WebSocketLink } from '@apollo/client/link/ws/ws.cjs';
import { getMainDefinition } from '@apollo/client/utilities/utilities.cjs';
import { SubscriptionClient } from 'subscriptions-transport-ws';
import ws from 'ws';
import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';

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
    const folderName = path1.basename(folderPath); 
    return folderName.split('__')[0]; 
};

const getLinkName = async (linkId) => {
    console.log(linkId, 'linkId11111')
    const nameLink = await deep.select({
        type_id: 3,
        to_id: linkId,
    });
    console.log(nameLink, 'nameLink11111')
    if (nameLink.data.length > 0) {
        console.log(nameLink.data, 'nameLink.data11111')
        console.log(nameLink.data[0].value, 'nameLink.data[0].value11111')
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



const replaceFile = async(filedir, newFileContent) => {
  fs.writeFile(filedir, newFileContent, (err) => {
    if (err) {
      console.error("Ошибка записи в файл:", err);
      return;
    }
    console.log('Файл успешно обновлен!');
  });
}


const renameFolder = async (oldFolderPath, link) => {
  try {

    if(typeof link != 'object') link = await deep.select({id: link})

    const name = await getLinkName(link)


    let newFolderName = name
      ? `${newLink.data[0].id}__${name}__${newLink.data[0].type_id}`
      : `${newLink.data[0].id}__${newLink.data[0].type_id}`;

    const newFolderPath = path.join(path.dirname(oldFolderPath), newFolderName);

    await fs.promises.rename(oldFolderPath, newFolderPath);
    console.log(`Папка успешно переименована в ${newFolderName}`);
  } catch (err) {
    console.error("Ошибка при переименовании папки:", err);
  }
}



const selectRelation = async (arrayLink, baseDir, subNum = null) => {
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


            if (subNum != null) await subClean(relationTypeDir, arrayLink[0].data, subNum); // Используем номер подписки

            const newLinkDir = subNum !== null 
              ? (nameLink ? `${objLink.id}__${nameLink}__${objLink.type_id}__${subNum}` : `${objLink.id}__${objLink.type_id}__${subNum}`)
              : (nameLink ? `${objLink.id}__${nameLink}__${objLink.type_id}` : `${objLink.id}__${objLink.type_id}`);


            linkDir = path.join(relationTypeDir, newLinkDir);


            // Проверка существования папки
            if (!fs.existsSync(linkDir)) {
                createDirectory(linkDir);
            }

            createValueFile(objLink, linkDir);
            createDataFile(objLink, linkDir);
        } else {
            linkDir = baseDir;
        }

        await passingInLink(arrayLink[0].return, objLink, linkDir, subNum);
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
const passingInLink = async (returnPath, arrayLink, baseDir, subNum = null) => {
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



        if (subNum != null) await subClean(relationTypeDir, arrayLink, subNum); // Используем номер подписки
              
        

        nameLink = await getLinkName(arrayLink[i].id);

        const newLinkDirName = subNum !== null 
          ? (nameLink ? `${arrayLink[i].id}__${nameLink}__${arrayLink[i].type_id}__${subNum}` : `${arrayLink[i].id}__${arrayLink[i].type_id}__${subNum}`)
          : (nameLink ? `${arrayLink[i].id}__${nameLink}__${arrayLink[i].type_id}` : `${arrayLink[i].id}__${arrayLink[i].type_id}`);

        newLinkDir = path.join(newDir, newLinkDirName);
  
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
              await processResult(result, data, currentDir);
              return;
          }

          // Проверка типа запроса
          if (typeof parsedData === 'object' && parsedData !== null) {
              if (parsedData.mode === 'req') {
                await handleRequest(parsedData, currentDir)
              } 
              // else if (parsedData.mode === 'sub') {

              //   setInterval(() => {
              //     handleRequest(parsedData, currentDir)
              //     console.log('Отправка данных по подписке...');
              // }, 3000);

              // }
              else {
                  console.error('Неизвестный режим:', parsedData.mode);
              }
          } else {
              console.error('Данные не являются корректным объектом:', parsedData);
          }
      } catch (error) {
          console.error('Ошибка при выполнении eval.js:', error);
          createFile(path.join(currentDir, 'eval.js'));
      }
  });
};


const handleRequest = async (parsedData, currentDir) => {
  let commandResults = [];
  let straightPathData = [];

  try {
    // Обработка команды, если есть
    if (parsedData.straightPath && parsedData.straightPath.length > 0) {
      straightPathData = await processStraightPath(parsedData.straightPath, currentDir);
    }
    if (parsedData.relationPath && parsedData.relationPath.length > 0) {
      await processRelationPath(parsedData.relationPath, currentDir);
    }


    if (parsedData.command) {
      console.log('Обработка команды:', parsedData.command);
      commandResults = await executeAsync(parsedData.command);

      commandResults = commandResults.data; // Сохраняем данные результатов
      console.log(commandResults, 'commandResults');

    
      console.log(straightPathData, 'straightPathData');

      // Теперь производим сравнение списков
      await commandStraightSync(commandResults, straightPathData);

    } else {
        console.warn('Команда не указана, выполняем baseStraightSync.');
        console.log(straightPathData, 'straightPathDataBASAAAAAAAAAAAAAA');
        await baseStraightSync(straightPathData, currentDir);
      }
  } catch (error) {
      console.error('Ошибка при выполнении команды:', error);
      createFile(path.join(currentDir, 'error.txt'), `${error}`);
  }
};




const baseStraightSync = async (straightPathResults, currentDir) => {

  console.log(straightPathResults, 'straightPathResults000000')



  for (const linkFolder of straightPathResults.results) {
      const linkPath = straightPathResults.path[linkId] 

      const dataPath = path.join(linkPath, 'data.json');



      const linkId = linkFolder.id;
      
      // Проверка существования связи в БД по linkId
      const currentLink = await deep.select({ id: linkId });
      const nameLink = await getLinkName(linkId);
      const nameFolderLink = straightPathResults.listNameLink[linkId];
      
      console.log(nameLink, 'nameLink0000');
      console.log(nameFolderLink, 'nameFolderLink0000');
      


      if (!fs.existsSync(linkPath) || !fs.existsSync(dataPath)) {
        console.warn(`Путь ${linkPath} или файл ${dataPath} не найдены!`);
        await deep.delete({id: linkId})
        console.warn(`связь ${linkId} удалена из дипа`);
        continue; // Переходим к следующей связи
      }


      
      // Если текущей связи нет в БД, создаем новую
      if (!currentLink || currentLink.data.length === 0) {
          console.log(linkFolder, 'linkFolder0000');
          const newLink = await deep.insert({
              from_id: linkFolder.from_id,
              to_id: linkFolder.to_id,
              type_id: linkFolder.type_id,
          });

          if (linkFolder.value) {
              await deep.update(
                  { link_id: newLink.data[0].id },
                  { value: linkFolder.value },
                  { table: (typeof linkFolder.value) + 's' }
              );  
          }
          console.log(`Создана новая связь с id ${newLink.data[0].id}`);


           // обновление data.json           
          console.log(`измененно значение  в файле ${dataPath} на ${newLink}`);
          await replaceFile(dataPath, newLink)
          // обновление названия
          renameFolder(linkPath, newLink)
      } else {
          // Если связь найдена, обновляем значения
          const existingLink = currentLink.data[0]; // Считаем, что мы получили нужный объект

          // Проверяем и обновляем name
          if (nameFolderLink != nameLink) {
              const test = await deep.select({ id: { type_id: 3, in: { linkId } } });
              console.log(test, 'testssss');

              await deep.update(
                  { link_id: { type_id: 3, in: { linkId } } },
                  { value: nameFolderLink },
                  { table: (typeof nameFolderLink) + 's' }
              );     
              console.log(`Обновлена связь ${linkId}`);
          }

          // Проверяем и обновляем другие поля
          if (existingLink.to_id !== linkFolder.to_id) {
              await deep.update(linkId, { to_id: linkFolder.to_id });
          }
          if (existingLink.from_id !== linkFolder.from_id) {
              await deep.update(linkId, { from_id: linkFolder.from_id });
          }
          if (existingLink.type_id !== linkFolder.type_id) {
              await deep.update(linkId, { type_id: linkFolder.type_id });

              renameFolder(linkPath, linkId)
          }

          if (existingLink.value !== linkFolder.value) {
              await deep.update(
                  { link_id: linkId },
                  { value: linkFolder.value },
                  { table: (typeof linkFolder.value) + 's' }
              );      
              console.log(`Обновлена связь ${linkId}`);
          }
      }
  }
};




// Функция для обработки пути реляций
const processRelationPath = async (relationPath, currentDir) => {
  console.log('Обработка relationPath:', relationPath);
  
};

const processStraightPath = async (straightPath, currentDir) => {
  console.log('Обработка straightPath:', straightPath);

  // Массив для хранения найденных значений
  const results = [];
  const listNameLink = {};
  const pathResults = [];
  for (const userPath of straightPath) {
      const absolutePath = path.join(currentDir, userPath);

      // Проверяем, существует ли путь
      if (fs.existsSync(absolutePath)) {
          const stats = fs.statSync(absolutePath);

          // Если это файл data.json
          if (stats.isFile() && path.basename(absolutePath) === 'data.json') {
              // Открываем файл и добавляем значение в список
              let data = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));

              // Получаем id из имени родительской папки
              const folderName = path.dirname(absolutePath).split(path.sep).pop(); // Папка-связь
              const linkId = folderName.split('__')[0];

              // Читаем значение из value.txt
              let value = fs.readFileSync(path.join(path.dirname(absolutePath), 'value.txt'), 'utf-8').trim(); // Убираем лишние пробелы
              console.log(data, 'data2222');

              if(value == 'null') value = null
              // Обновляем объект
              data = { ...data, value, id: Number(linkId) };   // Устанавливаем id из имени папки
              console.log(data, 'data3333');

              // Получаем имя ссылки и добавляем в список
              listNameLink[data.id] = await getLinkName(data.id);
              console.log(listNameLink, 'listNameLink3333');

              pathResults.push({ id: data.id, path: absolutePath });
              // Добавляем объект в массив results
              results.push(data);
              console.log('Значение добавлено из data.json:', data);
          }
          // Если это директория
          else if (stats.isDirectory()) {
              const files = fs.readdirSync(absolutePath);
              const hasRelationFiles = files.includes('data.json') && files.includes('value.txt');

              if (hasRelationFiles) {
                  // Папка-связь — обрабатываем файл data.json
                  const dataFilePath = path.join(absolutePath, 'data.json');
                  let data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));

                  const folderName = path.basename(absolutePath);
                  const linkId = folderName.split('__')[0];

                  // Читаем значение из value.txt
                  let value = fs.readFileSync(path.join(absolutePath, 'value.txt'), 'utf-8').trim(); // Убираем лишние пробелы
                  console.log(data, 'data2222');

                  // Обновляем объект
                  if(value == 'null') value = null
                  data = { ...data, value, id: Number(linkId) }; // Устанавливаем id из имени папки
                  console.log(data, 'data3333');

                  // Получаем имя ссылки и добавляем в список
                  listNameLink[data.id] = await getLinkName(data.id);
                  console.log(listNameLink, 'listNameLink3333');

                  pathResults.push({ id: data.id, path: absolutePath });
                  // Добавляем объект в массив results
                  results.push(data);
                  console.log('Обработаны данные связи из папки:', data);
              } else {
                  // Папка, нужная для поиска связанных папок — рекурсивно обрабатываем ее
                  const subDirs = files.filter(file => fs.statSync(path.join(absolutePath, file)).isDirectory());

                  for (const subDir of subDirs) {


  
                    
                      const subDirPath = path.join(absolutePath, subDir);
                      // Запускаем рекурсивный вызов и собираем результаты
                      const subResults = await processStraightPath([subDirPath], currentDir);
                      results.push(...subResults.results); // Делаем "распаковку" массива
                      pathResults.push(...subResults.pathResults); // Делаем "распаковку"массива
                      Object.assign(listNameLink, subResults.listNameLink); // Объединяем списки имен ссылок
                  }
              }
          }
      } else {
          console.warn(`Путь не существует: ${absolutePath}`);
      }
  }

  return { results: results, listNameLink: listNameLink, path: pathResults }; // Возвращаем результаты и список имен ссылок
};





const commandStraightSync = async (commandResults, straightPathData) => {
  let listNameLink = straightPathData.listNameLink
  let listValueDataLink = straightPathData.results
  let pathResults = straightPathData.path
  const idFolderLink = straightPathData.results.id


  console.log(straightPathData, 'commandStraightSynccommandStraightSynccommandStraightSync');

  console.log(listValueDataLink, 'commandStraightSynccommandStraightSynccommandStraightSync');
  const idSetFromStraightPath = new Set(listValueDataLink.map(item => item.id));
  
  console.log(straightPathData, 'straightPathData1111');

  // Перебираем значения из списка папок-связей
  for (const straightPathResult of listValueDataLink) {

      const linkPath = listValueDataLink.path[straightPathResult] 

      const dataPath = path.join(linkPath, 'data.json');


      const originalId = straightPathResult.id;  // id из папки-связи

      console.log(straightPathResult, 'straightPathResult');

      // Если в списке команд (commandResults) нет id, который есть в списке папок (listValueDataLink)
      console.log(originalId, '=====================');
      if (!commandResults.some(commandResult => commandResult.id === originalId)) {
          console.log(originalId, '=====================');
          console.log(originalId, 'linkId');
          console.log(idSetFromStraightPath, 'idSetFromStraightPath');

          // Ищем в БД связь с таким id
          const existingConnection = await deep.select({ id: originalId });
          console.log(existingConnection, 'existingConnections');

          // Если нет, то добавляем связь
          if (existingConnection.data.length === 0) {
              const nameLink = listNameLink[originalId] || undefined;

              // Создаем новую связь с указанной структурой
              const newLink = await deep.insert({
                  from_id: straightPathResult.from_id,
                  to_id: straightPathResult.to_id,
                  type_id: straightPathResult.type_id,
                  // Добавьте другие необходимые поля
              });
              if (straightPathResult.value) {
                console.log(straightPathResult.value)
                await deep.update(
                    { link_id: newLink.data[0].id },
                    { value: straightPathResult.value },
                    { table: (typeof straightPathResult.value) + 's' }
                );  
                console.log(`Обновлена связь ${straightPathResult}`);
              }
              if (nameLink) {
                const contain = await deep.insert({
                  from_id: 380,
                  to_id: newLink.data[0].id,
                  type_id: 3,
                });
                await deep.update(
                  { link_id: contain.data[0].id },
                  { value: nameLink },
                  { table: (typeof nameLink) + 's' }
                ); 
                console.log(`Добавлена контейн-связь ${contain.data[0].id} с содержимым ${nameLink}`);
            }

               // обновление data.json           
              console.log(`измененно значение  в файле ${dataPath} на ${newLink}`);
              await replaceFile(dataPath, newLink)
              // обновление названия папки-связи
              console.log(`измененно название папки-связи с  ${dataPath} на ${newLink}`);
              renameFolder(linkPath, newLink)

              console.log(`Добавлена связь ${originalId} из ${straightPathResult.from_id} в ${straightPathResult.to_id} с новым id ${newLink.data[0].id}`);
          }
      } else {
          // Если id совпадают, но другие значения этого объекта отсутствуют
          const commandResult = commandResults.find(cmdResult => cmdResult.id === originalId);
          if (commandResult) {

            const idFolderLink = straightPathResult.id;

            const nameLinkFolder = listNameLink[idFolderLink]
            const nameLinkCurrent = getLinkName(idFolderLink)

            console.log(nameLinkFolder, 'nameLinkFolder')
            console.log(nameLinkCurrent, 'nameLinkCurrent')

            if(nameLinkCurrent != nameLinkFolder){
              await deep.update(
                { link_id: { type_id: 3, in: { linkId } } },
                { value: idFolderLink },
                { table: (typeof idFolderLink) + 's' }
              );   
            }

            if (!areObjectsEqual(commandResult, straightPathResult)) {
              const updates = [];
          
              // Добавляем обновления для to_id, from_id, type_id
              if (commandResult.to_id !== straightPathResult.to_id) {
                updates.push({ to_id: straightPathResult.to_id });
              }
              if (commandResult.from_id !== straightPathResult.from_id) {
                updates.push({ from_id: straightPathResult.from_id });
              }
              if (commandResult.type_id !== straightPathResult.type_id) {
                updates.push({ type_id: straightPathResult.type_id });
              }
          
              // Добавляем обновление для value, включая тип
              if (commandResult.value !== straightPathResult.value) {
                updates.push({ value: straightPathResult.value });
                updates.push({ table: (typeof straightPathResult.value) + 's' });
              }

          
              // Обновляем в базе данных, если есть изменения
              if (updates.length > 0) {
                await deep.update({ id: originalId }, updates);
                console.log(`Обновлена связь с id ${originalId} на ${JSON.stringify(updates)}`);
              }
            }

            
          }
          // if (commandResult) {
          //   if (!areObjectsEqual(commandResult, straightPathResult)) {
          //     let updates = {};
          
          //     if (commandResult.to_id !== straightPathResult.to_id)
          //       updates = Object.assign(updates, { to_id: straightPathResult.to_id });
          //     if (commandResult.from_id !== straightPathResult.from_id)
          //       updates = Object.assign(updates, {
          //         from_id: straightPathResult.from_id,
          //       });
          //     if (commandResult.type_id !== straightPathResult.type_id)
          //       updates = Object.assign(updates, {
          //         type_id: straightPathResult.type_id,
          //       });
          //     if (commandResult.value !== straightPathResult.value) {
          //       updates = Object.assign(updates, {
          //         value: straightPathResult.value,
          //       });
          //       updates = Object.assign(updates, {
          //         table: (typeof straightPathResult.value) + 's',
          //       });
          //     }
          
          //     if (Object.keys(updates).length > 0) {
          //       await deep.update({ id: originalId }, updates);
          //       console.log(`Обновлена связь с id ${originalId} на ${JSON.stringify(updates)}`);
          //     }
          //   }
          // }
      }
  }

  // Удаляем лишние записи в БД
  const idSetFromCommandResults = new Set(commandResults.map(item => item.id));
  const listValueDataLinkId = new Set(listValueDataLink.map(item => item.id));

  console.log(idSetFromCommandResults, 'idSetFromCommandResults9999')
  console.log(listValueDataLinkId, 'listValueDataLinkId9999')
  console.log(commandResults, 'commandResults999911111')
  console.log(listValueDataLink, 'listValueDataLink999911111')
  // Перебираем связи из папочной структуры
  for (const idSetFromCommandResult of idSetFromCommandResults) {
      console.log(idSetFromCommandResult, 'idSetFromCommandResult9999')
      // Если id из команд присутствует в БД, но отсутствует в папочной структуре

      console.log(listValueDataLinkId, 'listValueDataLinkId999900000')
      if (!straightPathResultsId.has(idSetFromCommandResult)) {
          const existingConnection = await deep.select({ id: idSetFromCommandResult });
          if (existingConnection.data.length > 0) {
              await deep.delete({ id: idSetFromCommandResult });
              console.log(`Удалена связь с id ${idSetFromCommandResult}, так как она отсутствует в папочной структуре.`);
          }
      }
  }
};


const areObjectsEqual = (obj1, obj2) => {
  // Здесь можно добавить более детальную логику сравнения
  return JSON.stringify(obj1) === JSON.stringify(obj2);
};


const processResult = async (resultData, data, currentDir) => {
  console.log(resultData, 'resultData');

  // Если это подписка, используем полученный resultData
  if (resultData && typeof resultData.subscribe === 'function') {
      const subscriptionResult = await handleSubscription(resultData, currentDir, data);
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







const selectSimple = async (resultData, currentDir, subNum = null) => {
  const linkList = resultData[0].data || resultData[0]; // Получаем список связей

  if (subNum != null) await subClean(currentDir, linkList, subNum); // Используем номер подписки
  
  for (const link of linkList) {
      const nameLink = await getLinkName(link.id);
      
      // Формируем имя папки в зависимости от наличия subNum
      const newLinkDir = subNum !== null 
          ? (nameLink ? `${link.id}__${nameLink}__${link.type_id}__${subNum}` : `${link.id}__${link.type_id}__${subNum}`)
          : (nameLink ? `${link.id}__${nameLink}__${link.type_id}` : `${link.id}__${link.type_id}`);
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
              `${dirId}__${nameLink}__${linkType}__${subNum}` : 
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




const watcher = chokidar.watch(dirPath);

const path1 = path
let oldDirName = null;

watcher.on('all', async (event, path, stats) => {
    const currentDir = path1.dirname(path);
    console.log(event, 'event')



    if (event === 'unlinkDir') {
        oldDirName = path; // Сохраняем имя старой папки
    } else if (event === 'addDir') {
        if (oldDirName) {
            const oldDir = path1.basename(oldDirName);
            const newDir = path1.basename(path);
    
            if (oldDir !== newDir) {
                const dataFilePath = path1.join(currentDir, newDir, 'data.json');
                if (fs.existsSync(dataFilePath)) {
                    try {
                        let data = fs.readFileSync(dataFilePath, 'utf8');
                        data = JSON.parse(data);
    
                        // Извлечение id из названия папки
                        const dirComponents = newDir.split('__');
                        if (dirComponents.length > 1) {
                            data.id = parseInt(dirComponents[0], 10);
                            data.type_id = parseInt(dirComponents[dirComponents.length - 1], 10);
    
                            // Обновление файла data.json
                            fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
                            console.log(`Файл data.json обновлен в директории ${newDir}`);
                        }
                    } catch (error) {
                        console.error(`Ошибка обработки data.json в ${currentDir}: ${error}`);
                    }
                }
                // Обработка переименования папки
    
                // Очистка oldDirName
                oldDirName = null;
            }
        } 
    } else if (event === 'change') {
        const newDir = path1.basename(path);
        const dataFilePath = path1.join(currentDir, newDir, 'eval.js');
        if (fs.existsSync(dataFilePath)) {
            try {
                let data = fs.readFileSync(dataFilePath, 'utf8');
                data = JSON.parse(data);
    
                // Обновление файла данных
                // Ваша логика обновления данных
    
                fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
                console.log(`Файл eval.js обновлен в директории ${newDir}`);
            } catch (error) {
                console.error(`Ошибка обработки eval.js в ${currentDir}: ${error}`);
            }
        }
    } else if (event === 'unlink') {
        const newDir = path1.basename(path);
        const dataFilePath = path1.join(currentDir, 'eval.js');
        if (!fs.existsSync(dataFilePath)) {
            try {
                const newData = { id: 0, type_id: 0 }; // Здесь можно определить начальные данные для нового файла
                fs.writeFileSync(dataFilePath, JSON.stringify(newData, null, 2));
                console.log(`Создан новый файл eval.js в директории ${newDir}`);
            } catch (error) {
                console.error(`Ошибка создания eval.js в ${currentDir}: ${error}`);
            }
        }
    }
});





// Функция для чтения файла
const fileread = (currentDir) => {
  return new Promise((resolve, reject) => {
    fs.readFile(currentDir, 'utf8', (err, data) => {
      if (err) {
        console.error('Ошибка чтения:',currentDir, err);
        reject(err);
        return;
      }
      resolve(data);
    });
  });
};

async function updateDataFile(dataFilePath, newDir) {
  try {
    const data = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));

    // Разбиваем имя папки на части
    const parts = newDir.split('__');

    // Извлекаем первый и последний элементы
    const id = parseInt(parts[0], 10);
    const typeId = parseInt(parts[parts.length - 1], 10);

    // Обновляем данные в файле
    data.id = id;
    data.type_id = typeId;

    // Записываем обновленные данные в файл
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    throw error;
  }
}





