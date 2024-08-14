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
    console.log(data, 'data')
    let nameLink;
    let newLinkDir;
    if (data === undefined) return;

    let relationNewName = data[0];
    let relationOldName = data[1];
    let returnNewPath = data[2];
    let newDir = path.join(baseDir, relationNewName);
    await createDirectory(newDir); 


    console.log(arrayLink, 'arrayLink111111')
    
    if (typeof arrayLink === 'object') arrayLink = arrayLink[relationOldName];
    if(arrayLink == null) return;
    if (!Array.isArray(arrayLink)) arrayLink = [arrayLink];

    console.log(arrayLink, 'arrayLink22222')
    console.log(arrayLink.length, 'arrayLink.length22222')
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






const saveSubscriptionData = async (data, currentDir) => {
  const subFileName = `sub${subscriptionCount}.js`; // Уникальное имя файла
  const subFilePath = path.join(currentDir, subFileName);
  try {
      await createFile(subFilePath, data);
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
          await createFile(path.join(currentDir, 'eval.js'));
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
      await createFile(path.join(currentDir, 'error.txt'), `${error}`);
  }
};




const baseStraightSync = async (straightPathResults, currentDir) => {

  console.log(straightPathResults, 'straightPathResults000000')



  for (const linkFolder of straightPathResults.results) {


      const linkId = linkFolder.id;


      const linkPath = straightPathResults.path.find(pathResult => pathResult.id === linkId)
      console.log(straightPathResults.path, 'straightPathResults.path')
      console.log(linkPath, 'linkPath')
      console.log(linkId, 'linkId')
      const dataPath = path.join(linkPath.path, 'data.json');



      
      // Проверка существования связи в БД по linkId
      const currentLink = await deep.select({ id: linkId });
      console.log(currentLink);
      console.log('currentLink========');
      const nameLink = await getLinkName(linkId);
      const nameFolderLink = straightPathResults.listNameLink[linkId];
      
      console.log(nameLink, 'nameLink0000');
      console.log(nameFolderLink, 'nameFolderLink0000');
      


      // if (!fs.existsSync(linkPath) || !fs.existsSync(dataPath)) {
      //   console.warn(`Путь ${linkPath} или файл ${dataPath} не найдены!`);
      //   await deep.delete({id: linkId})
      //   console.warn(`связь  ${linkPath} удалена!`);
      //   continue; // Переходим к следующей связи
      // }


      
      // Если текущей связи нет в БД, создаем новую
      if (!currentLink || currentLink.data.length === 0) {
          console.log(linkFolder, 'linkFolder0000');
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
              //data = { ...data, value, id: Number(linkId) };   // Устанавливаем id из имени папки
              console.log(data, 'data3333');

              // Получаем имя ссылки и добавляем в список
              if(data.data) data = data.data[0]
              console.log(data, '5556666');
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

                

                  // Читаем значение из value.txt
                  let value = fs.readFileSync(path.join(absolutePath, 'value.txt'), 'utf-8').trim(); // Убираем лишние пробелы
                  console.log(data, 'data2222');

                  // Обновляем объект
                  if(value == 'null') value = null
                  //data = { ...data, value, id: Number(linkId) }; // Устанавливаем id из имени папки
                  console.log(data, 'data3333444');
                  if(data.data) data = data.data[0]
                  console.log(data, '5556666');
                  // Получаем имя ссылки и добавляем в список
                  console.log(folderName.split('__'), 'folderName.split()' )
                  if(folderName.split('__').length >= 3) {
                    listNameLink[data.id] = folderName.split('__')[1];
                    console.log(folderName.split('__')[1], 'folderName.split()[2]');
                  } else{
                    listNameLink[data.id] = await getLinkName(data.id);
                    console.log(listNameLink, 'listNameLink2222');
                  }

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

      const originalId = Number(straightPathResult.id);  // id из папки-связи
      const linkPath = pathResults.find(pathResult => pathResult.id === originalId)
      // console.log(linkPath.path, 'linkPath.path')
      const dataPath = path.join(linkPath.path, 'data.json');



      // console.log(straightPathResult, 'straightPathResult');

      // Если в списке команд (commandResults) нет id, который есть в списке папок (listValueDataLink)
      console.log(originalId, '=====================');
      if (!commandResults.some(commandResult => commandResult.id === originalId)) {
          // console.log(originalId, 'straightPathResult');
          // console.log(idSetFromStraightPath, 'idSetFromStraightPath');

          // Ищем в БД связь с таким id
          const existingConnection = await deep.select({ id: originalId });
          console.log(existingConnection, 'existingConnections');

          // Если нет, то добавляем связь
          if (existingConnection.data.length === 0) {
              const nameLink = listNameLink[originalId] || ""
              console.log(straightPathResult, 'straightPathResult------')

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

            console.log(nameLinkFolder, 'nameLinkFolder')
            console.log(nameLinkCurrent, 'nameLinkCurrent')

            console.log(idFolderLink, 'idFolderLink')

            if(nameLinkCurrent != nameLinkFolder){ // нужно что-то придмать с тем, чтобы это работало и в пустых контейнах. сейчас он изменяет содержимое только если оно уже есть
              const contain = await deep.select({ type_id: 3, to: { id: idFolderLink } })
              console.log('попытка изменить связь', contain.data[0].id)
              await deep.update(
                { link_id: contain.data[0].id },
                { value: nameLinkFolder },
                { table: (typeof nameLinkFolder) + 's' }
              );   
            }
            if (!areObjectsEqual(commandResult, straightPathResult)) {
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
              console.log(commandResult.value, 'commandResult.value')
              console.log(straightPathResult.value, 'straightPathResult.value')
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
          // if (commandResult) {
          //   if (!areObjectsEqual(commandResult, straightPathResult)) {
          //     let updates = {};
          
              // if (commandResult.to_id !== straightPathResult.to_id)
              //   updates = Object.assign(updates, { to_id: straightPathResult.to_id });
              // if (commandResult.from_id !== straightPathResult.from_id)
              //   updates = Object.assign(updates, {
              //     from_id: straightPathResult.from_id,
              //   });
              // if (commandResult.type_id !== straightPathResult.type_id)
              //   updates = Object.assign(updates, {
              //     type_id: straightPathResult.type_id,
              //   });
              // if (commandResult.value !== straightPathResult.value) {
              //   updates = Object.assign(updates, {
              //     value: straightPathResult.value,
              //   });
              //   updates = Object.assign(updates, {
              //     table: (typeof straightPathResult.value) + 's',
              //   });
              // }
          
              // if (Object.keys(updates).length > 0) {
              //   await deep.update({ id: originalId }, updates);
              //   console.log(`Обновлена связь с id ${originalId} на ${JSON.stringify(updates)}`);
              // }
          //   }
          // }
      }
  }

  // Удаляем лишние записи в БД
  const idSetFromCommandResults = new Set(commandResults.map(item => item.id));
  const listValueDataLinkId = new Set(listValueDataLink.map(item => item.id));

  // console.log(idSetFromCommandResults, 'idSetFromCommandResults9999')
  // console.log(listValueDataLinkId, 'listValueDataLinkId9999')
  // console.log(commandResults, 'commandResults999911111')
  // console.log(listValueDataLink, 'listValueDataLink999911111')
  // Перебираем связи из папочной структуры
  for (const idSetFromCommandResult of idSetFromCommandResults) {
      // console.log(idSetFromCommandResult, 'idSetFromCommandResult9999')
      // Если id из команд присутствует в БД, но отсутствует в папочной структуре

      // console.log(listValueDataLinkId, 'listValueDataLinkId999900000')
      if (!listValueDataLinkId.has(idSetFromCommandResult)) {
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







const selectSimple = async (resultData, currentDir, subName = null) => {
  const linkList = resultData[0].data || resultData[0]; // Получаем список связей

  if (subName != null) await subClean(currentDir, linkList, subName); // Используем номер подписки
  
  for (const link of linkList) {
      const nameLink = await getLinkName(link.id);
      
      // Формируем имя папки в зависимости от наличия subName
      const newLinkDir = subName !== null 
          ? (nameLink ? `${link.id}__${nameLink}__${link.type_id}--${subName}` : `${link.id}__${link.type_id}--${subName}`)
          : (nameLink ? `${link.id}__${nameLink}__${link.type_id}` : `${link.id}__${link.type_id}`);
      console.log(newLinkDir, 'newLinkDir')
      console.log(link.id, 'link.id')
      console.log(link.type_id, 'link.type_id')
      console.log(nameLink, 'nameLink')

      // Создаем директорию, если её еще нет
      await createDirectory(path.join(currentDir, newLinkDir));
      await createValueFile(link, path.join(currentDir, newLinkDir));
      await createDataFile(link, path.join(currentDir, newLinkDir));
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
      console.log(dirId, 'dirId', typeof dirId);
      console.log(existingLinkIds.has(dirId), 'existingLinkIds.has(dirId)');


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
          console.log(nameLink.data[0].value, 'nameLink.data[0].value')
          if (nameLink.data.length > 0) {
            console.log(nameLink.data[0].value, 'nameLink.data[0].value')
            if(nameLink.data[0].value == null) nameLink = undefined
            else nameLink = nameLink.data[0].value.value;
          } else{
            nameLink = undefined
          }
          console.log(nameLink, 'nameLink9999')
          const linkType = linkList.find(link => link.id === dirId).type_id;

          const expectedDirName = nameLink ? 
              `${dirId}__${nameLink}__${linkType}--${subName}` : 
              `${dirId}__${linkType}--${subName}`;

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
            data.value.value = newValue; // Заменяем значение
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















  // const processStraightPath = async (straightPath, currentDir) => {
  //   console.log('Обработка straightPath:', straightPath);
  
  //   // Массив для хранения найденных значений
  //   const results = [];
  //   const listNameLink = {};
  //   const pathResults = []; // Новый массив для хранения { id, path }
  //   let data;
  //   for (const userPath of straightPath) {
  //       const absolutePath = path.join(currentDir, userPath);
  //       // Проверяем, существует ли путь
  //       if (fs.existsSync(absolutePath)) {
  //           const stats = fs.statSync(absolutePath);
  
  //           // Если это файл data.json
  //           if (stats.isFile() && path.basename(absolutePath) === 'data.json') {
  //               data = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
  
  //               // Получаем id из имени родительской папки
  //               const folderName = path.dirname(absolutePath).split(path.sep).pop(); // Папка-связь
  //               const linkId = folderName.split('__')[0];
  
  //               // Читаем значение из value.txt
  //               const value = fs.readFileSync(path.join(path.dirname(absolutePath), 'value.txt'), 'utf-8');
  //               console.log(data, 'data2222');
  
  //               // Обновляем объект
  //               data = { ...data, value, id: Number(linkId) };   // Устанавливаем id из имени папки
  //               console.log(data, 'data3333');
  
  //               listNameLink[data.id] = await getLinkName(data.id);
  //               console.log(listNameLink, 'listNameLink3333');
  
  //               // Добавляем объект в массив pathResults
  //               pathResults.push({ id: data.id, path: absolutePath });
  //               console.log('Значение добавлено из data.json:', data);
  //           }
  //           // Если это директория
  //           else if (stats.isDirectory()) {
  //               const files = fs.readdirSync(absolutePath);
  //               const hasRelationFiles = files.includes('data.json') && files.includes('value.txt');
  
  //               if (hasRelationFiles) {
  //                   // Папка-связь — обрабатываем файл data.json
  //                   const dataFilePath = path.join(absolutePath, 'data.json');
  //                   data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
  
  //                   const folderName = path.basename(absolutePath);
  //                   const linkId = folderName.split('__')[0];
  
  //                   // Читаем значение из value.txt
  //                   const value = fs.readFileSync(path.join(absolutePath, 'value.txt'), 'utf-8');
  //                   console.log(data, 'data2222');
  
  //                   // Обновляем объект
  //                   data = { ...data, value, id: Number(linkId) }; // Устанавливаем id из имени папки
  //                   console.log(data, 'data3333');
  
  //                   listNameLink[data.id] = await getLinkName(data.id);
  //                   console.log(listNameLink, 'listNameLink3333');

                    
  //                   // Добавляем объект в массив pathResults
  //                   pathResults.push({ id: data.id, path: absolutePath });
  //                   console.log('Обработаны данные связи из папки:', data);
  //               } else {
  //                   // Папка, нужная для поиска связанных папок — рекурсивно обрабатываем ее
  //                   const subDirs = files.filter(file => fs.statSync(path.join(absolutePath, file)).isDirectory());
  
  //                   for (const subDir of subDirs) {
  //                       const subDirPath = path.join(absolutePath, subDir);
  //                       // Запускаем рекурсивный вызов и собираем результаты
  //                       const subResults = await processStraightPath([subDirPath], currentDir);
  //                       pathResults.push(...subResults.pathResults); // Делаем "распаковку"массива
  //                       Object.assign(listNameLink, subResults.listNameLink); // Объединяем списки имен ссылок
  //                   }
  //               }
  //           }
  //       } else {
  //           console.warn(`Путь не существует: ${absolutePath}`);
  //       }
  //   }
  
  //   return { results: data, listNameLink: listNameLink, path: pathResults }; // Возвращаем результаты, список имен ссылок и пути
  // };

