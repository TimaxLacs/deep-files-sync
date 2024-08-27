import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';

// Корневой путь
const dirPath = '/home/timax/Code/Deep-project/deep-files-sync/test';



const renameFolder = async (filedir, link, manually) => {
   console.log(filedir, 'filedir')
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
       console.log(`поиск в {link}`);
       console.log(link)
       if(typeof link != 'object') link = await deep.select({id: link})
       else link = await deep.select({id: link.id})
       console.log(link, 'linkFolder222')
       const name = await getLinkName(link.data[0].id)
       console.log(`название в ${name}`);
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
 
 

 

// Проверка существования data.json
const dataJsonExists = (filePath) => fs.existsSync(filePath);

// Функция для записи data.json
const writeDataJson = (dataJsonPath, data) => {
    fs.writeFileSync(dataJsonPath, JSON.stringify(data, null, 2));
    //console.log("data.json обновлён в директории: " + path.dirname(dataJsonPath));
};

// Обновление data.json
const updateDataJson = (dirPath, data) => {
   // console.log(dirPath, 'dirPath22222')
   // console.log(data, 'data22222')
   const dataJsonPath = path.join(dirPath, 'data.json');
   if (dataJsonExists(dataJsonPath)) {
     const currentData = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
 
     // Обновление только если есть изменения
     if (JSON.stringify(currentData) !== JSON.stringify(data)) {
       writeDataJson(dataJsonPath, data);
     }
   } else {
     // Файл data.json не существует, создаем его
     console.log("data.json обновлён в директории: " + path.dirname(dataJsonPath));
     fs.writeFileSync(dataJsonPath, JSON.stringify(data, null, 2));
   //   writeDataJson(dataJsonPath, data);
   }
 };

// Синхронизация значений в data.json с именем папки
const syncFolderNamesWithIds = (dirPath) => {
    const currentFolderName = path.basename(dirPath);
    const parts = currentFolderName.split('__');

    if (parts.length < 2) return; // Проверка на корректность формата

    const id = Number(parts[0]);
    const typeId = Number(parts[parts.length - 1]);

    const dataJsonPath = path.join(dirPath, 'data.json');

    if (dataJsonExists(dataJsonPath)) {
        let data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));

        // Обновляем data.json на основе имени папки (односторонняя синхронизация)
        if (data.id !== id || data.type_id !== typeId) {
            data.id = id;
            data.type_id = typeId;
            updateDataJson(dirPath, data);
        }
    }
};

// Проверка и обновление значений в зависимости от отношений
const updateDataFromRelations = async (dirPath, data) => {
   const dataJsonPath = path.join(dirPath, 'data.json');
   let typedUpdate = false;
   let typeUpdate2 = false;
   let typeUpdate = false;
   if (!dataJsonExists(dataJsonPath)) {
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
       if (dataJsonExists(subDataJsonPath)) {
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
 
   // Проверка родительских директорий на наличие relations: in, out, typed
   const parentDir = path.dirname(dirPath);
   const relationDirs = ['in', 'out', 'typed'];
 
   for (const relation of relationDirs) {
     const parentRelationPath = path.join(path.dirname(parentDir), relation);
     if (fs.existsSync(parentRelationPath) && fs.statSync(parentRelationPath).isDirectory()) {
 
       const subDataJsonPath = path.join(path.dirname(parentDir), 'data.json');
       if (dataJsonExists(subDataJsonPath)) {
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
           if (relation === 'typed') {
             if (data.type_id !== relationId && !typeUpdate) {
               if(!fs.existsSync(path.join(dirPath, 'type'))){
                  typedUpdate = relationId;
                  // updated = true; // Значение обновлено
               }
             }
           }
         }
       }
     }
   }
 
   //console.log(typeUpdate2, 'typeUpdate2')
   if(typedUpdate){
     dirPath = await renameFolder(dirPath, typedUpdate, 'type');
   }
 
   // Записываем изменения обратно в data.json только если данные изменились
   if (updated) {
     updateDataJson(dirPath, data);
   }
 };


// Обработка изменений
const processChanges = (dirPath) => {
    // Сначала синхронизируем значения в data.json с именем папки
    syncFolderNamesWithIds(dirPath);

    // Обновляем данные на основе других папок
    const dataJsonPath = path.join(dirPath, 'data.json');
    if (dataJsonExists(dataJsonPath)) {
        let data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
        updateDataFromRelations(dirPath, data);
    }
};

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

// Функция для создания файла
const createFile = async (filePath, content = '') => {
    if (!await fs.promises.stat(filePath).catch(() => false)) {
        await fs.promises.writeFile(filePath, content, { flag: 'w' });
    }
};

// Функция для выполнения eval.js
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
                //console.log(parsedData, 'parsedData')
            } catch (parseError) {
                // Если не удалось парсить как объект, выполняем как обычно
                console.warn('Содержимое не является объектом, выполняем как обычный код.');
                const result = await executeAsync(data);
                //console.log('результат поиска', result)
                await processResult(result, data, currentDir);
                return;
            }

            // Проверка типа запроса
            if (typeof parsedData === 'object' && parsedData !== null) {
                if (parsedData.mode === 'req') {
                    await handleRequest(parsedData, currentDir)
                } else if (parsedData.mode === 'sub') {
                    await handleSubscriptionOut(parsedData, currentDir);
                } else {
                    console.error('Неизвестный режим:', parsedData.mode);
                }
            } else {
                console.error('Данные не являются корректным объектом:', parsedData);
            }
        } catch (error) {
            console.error('Ошибкапри выполнении eval.js:', error);
            await createFile(path.join(currentDir, 'eval.js'));
        }
    });
};

// Обработка удаления файла eval.js
const evalData = {};

// Настройка наблюдателя на изменения
const watcher = chokidar.watch(dirPath, { persistent: true });

watcher.on('rename', (oldPath, newPath) => {
   //console.log("Папка переименована с " + oldPath + " на " + newPath);
   setTimeout(() => processChanges(path.dirname(newPath)), 100);
}).on('addDir', path1 => {
   if (!path.basename(path1).startsWith(".")) {
       //console.log("Папка добавлена: " + path1);
       setTimeout(() => processChanges(path1), 100);
   }
}).on('change', path1 => {
   if (!path.basename(path1).startsWith(".") && !path.basename(path1).includes('data.json')) {
       console.log("Изменение: " + path1);
       setTimeout(() => processChanges(path.dirname(path1)), 100);

       // Обработка изменения value.txt
       if (path.basename(path1) === 'value.txt') {
           const currentDir = path.dirname(path1);
           const dataJsonPath = path.join(currentDir, 'data.json');
           if (dataJsonExists(dataJsonPath)) {
               const data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
               console.log(data, 'datadatadata')
               console.log(data.value, 'data.valuedata.valuedata.value')
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
}).on('unlink', path1 => {
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
}).on('error', error => {
   console.error("Ошибка с наблюдателем:", error);
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
