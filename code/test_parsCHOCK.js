// import fs from 'fs';
// import path from 'path';
// import chokidar from 'chokidar';

// // Корневой путь
// const dirPath = '/home/timax/Code/Deep-project/deep-files-sync/test';

// // Проверка существования data.json
// const dataJsonExists = (filePath) => fs.existsSync(filePath);

// // Обновление data.json
// const updateDataJson = (dirPath, id, typeId) => {
//     const dataJsonPath = path.join(dirPath, 'data.json');

//     if (dataJsonExists(dataJsonPath)) {
//         let data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));

//         const originalId = data.id;
//         const originalTypeId = data.type_id;

//         // Обновляем data.json только если значения поменялись
//         if (originalId !== id || originalTypeId !== typeId) {
//             data.id = id;
//             data.type_id = typeId;
//             fs.writeFileSync(dataJsonPath, JSON.stringify(data, null, 2));
//             console.log("Обновлено data.json в директории: " + dirPath);
//             const dirname = path.basename(path.dirname(dataJsonPath))
//             const newPath = path.join(path.dirname(path.dirname(dataJsonPath)), String(data.id))
//             fs.renameSync(path.dirname(dataJsonPath), newPath);
//             return true; // Вернуть true, если произведены изменения
//         }
//     } else {
//         console.log("data.json не найден в директории: " + dirPath);
//     }
//     return false; // Если ничего не изменилось
// };

// // Переименование, если значения в data.json изменились
// const renameIfNeeded = (dirPath, data) => {
//     const parentDir = path.dirname(dirPath);
//     const newFolderName = `${data.id}__${data.type_id}`;
//     const newPath = path.join(parentDir, newFolderName);

//     // Переименовать только если новая папка отличается от текущей
//     if (newPath !== dirPath) {
//         try {
//             fs.renameSync(dirPath, newPath);
//             console.log(`Папка переименована с ${path.basename(dirPath)} на ${newFolderName}`);
//             updateDataJson(newPath, data.id, data.type_id); // Обновляем data.json после переименования
//         } catch (error) {
//             console.error("Ошибка при переименовании папки:", error);
//         }
//     }
// };

// // Функция для синхронизации имен папок с id и type_id
// const syncFolderNamesWithIds = (dirPath) => {
//     const currentFolderName = path.basename(dirPath);
//     const parts = currentFolderName.split('__');

//     if (parts.length < 2) return; // Проверка на корректность формата

//     const id = Number(parts[0]);
//     const typeId = Number(parts[parts.length - 1]);

//     // Получаем путь к data.json
//     const dataJsonPath = path.join(dirPath, 'data.json');

//     if (dataJsonExists(dataJsonPath)) {
//         let data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
        
//         // Если значения id и type_id отличаются от имени папки, обновляем data.json
//         if (data.id !== id || data.type_id !== typeId) {
//             updateDataJson(dirPath, id, typeId); // Обновляем data.json
//         }
//     }
// };

// // Обновление данных в зависимости от связанных папок
// const updateDataFromRelations = (dirPath, data) => {
//     const relationTypes = ['in', 'out', 'typed', 'from', 'to', 'type'];

//     relationTypes.forEach(relation => {
//         const currentRelationPath = path.join(dirPath, relation);
//         if (dataJsonExists(currentRelationPath) && fs.statSync(currentRelationPath).isDirectory()) {
//             const subDirs = fs.readdirSync(currentRelationPath).filter(name => fs.statSync(path.join(currentRelationPath, name)).isDirectory());

//             for (const subDir of subDirs) {
//                 const subDataJsonPath = path.join(currentRelationPath, subDir, 'data.json');
//                 if (dataJsonExists(subDataJsonPath)) {
//                     const relationData = JSON.parse(fs.readFileSync(subDataJsonPath, 'utf-8'));
//                     if (relationData.id) {
//                         if (relation === 'from') data.from_id = relationData.id;
//                         if (relation === 'to') data.to_id = relationData.id;
//                         if (relation === 'type') data.type_id = relationData.id;
//                         if (relation === 'in') data.to_id = relationData.id;
//                         if (relation === 'out') data.from_id = relationData.id;
//                         if (relation === 'typed') data.type_id = relationData.id;
//                         break; 
//                     }
//                 }
//             }
//         }
//     });
// };

// // Процесс обработки изменений
// const processChanges = (dirPath) => {
//     const dataJsonPath = path.join(dirPath, 'data.json');

//     // Сначала синхронизируем значения в data.json с именем папки
//     syncFolderNamesWithIds(dirPath);

//     // Если data.json существует, обновляем папку на основе данных
//     if (dataJsonExists(dataJsonPath)) {
//         let data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));

//         // Обновляем данные в зависимости от других папок
//         updateDataFromRelations(dirPath, data);

//         // Переименовываем папку в соответствии с новыми значениями
//         renameIfNeeded(dirPath, data);
//     }
// };

// // Настройка наблюдателя на изменения
// const watcher = chokidar.watch(dirPath, { persistent: true });

// watcher.on('rename', (oldPath, newPath) => {
//     console.log(`Папка переименована с ${oldPath} на ${newPath}`);
//     setTimeout(() => processChanges(path.dirname(newPath)), 100);
// }).on('addDir', path1 => {
//     if (!path.basename(path1).startsWith(".")) {
//         console.log(`Папка добавлена: ${path1}`);
//         setTimeout(() => processChanges(path1), 100);
//     }
// }).on('change', path1 => {
//     if (!path.basename(path1).startsWith(".")) {
//         console.log(`Изменение: ${path1}`);
//         setTimeout(() => processChanges(path.dirname(path1)), 100);
//     }
// }).on('error', error => {
//     console.error("Ошибка с наблюдателем:", error);
// });

// // Обработка существующих директорий при старте
// const initialScan = (dirPath) => {
//     if (fs.existsSync(dirPath)) {
//         const subDirs = fs.readdirSync(dirPath).filter(name => fs.statSync(path.join(dirPath, name)).isDirectory());
//         for (const subDir of subDirs) {
//             const subDirPath = path.join(dirPath, subDir);
//             processChanges(subDirPath);
//             initialScan(subDirPath);
//         }
//     }
// };

// // Начальный обход существующих директорий
// initialScan(dirPath);
// console.log("Наблюдатель запущен. Отслеживание изменений...");




import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';

// Корневой путь
const dirPath = '/home/timax/Code/Deep-project/deep-files-sync/test';

// Проверка существования data.json
const dataJsonExists = (filePath) => fs.existsSync(filePath);

// Функция для записи data.json
const writeDataJson = (dataJsonPath, data) => {
    fs.writeFileSync(dataJsonPath, JSON.stringify(data, null, 2));
    //console.log("data.json обновлён в директории: " + path.dirname(dataJsonPath));
};


// Обновление data.json
const updateDataJson = (dirPath, data) => {
    console.log(dirPath, 'dirPath22222')
    console.log(data, 'data22222')
    const dataJsonPath = path.join(dirPath, 'data.json');
    if (dataJsonExists(dataJsonPath)) {
        const currentData = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));

        // Обновление только если есть изменения
        if (JSON.stringify(currentData) !== JSON.stringify(data)) {
            writeDataJson(dataJsonPath, data);
        }
    } else {
        console.log("data.json не найден в директории: " + dirPath);
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
const updateDataFromRelations = (dirPath, data) => {
    const dataJsonPath = path.join(dirPath, 'data.json');

    if (!dataJsonExists(dataJsonPath)) {
        console.log("data.json не найден в директории " + dirPath);
        return;
    }

    let updated = false; // отслеживание обновлений

    // Проверка родительских директорий на наличие relations: in, out, typed
    const parentDir = path.dirname(dirPath);
    const relationDirs = ['in', 'out', 'typed'];
    // console.log(dirPath, 'dirPath1111')
    // console.log(data, 'data1111')
    //console.log(parentDir, 'parentDir1111')
    for (const relation of relationDirs) {
        const parentRelationPath = path.join(path.dirname(parentDir), relation);
        if (fs.existsSync(parentRelationPath) && fs.statSync(parentRelationPath).isDirectory()) {

            const subDataJsonPath = path.join(path.dirname(parentDir), 'data.json');
            console.log(subDataJsonPath, 'subDataJsonPath1111')
            if (dataJsonExists(subDataJsonPath)) {
                const relationData = JSON.parse(fs.readFileSync(subDataJsonPath, 'utf-8'));
                const relationId = relationData.id;
                console.log(data, 'data1111')
                console.log(relationId, 'relationId1111')
                // Обновляем данные в зависимости от найденного идентификатора
                if (relationId && !isNaN(relationId)) {
                    if (relation === 'in') data.to_id = relationId;
                    if (relation === 'out') data.from_id = relationId;
                    if (relation === 'typed') data.type_id = relationId;
                    updated = true; // Значение обновлено
                }
            }
        }
    }

    if (updated) {
        updateDataJson(dirPath, data);
    }

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


                // console.log(data, 'data')
                // console.log(relationId, 'relationId')
                // console.log(dirPath, 'dirPath')
                // Обновляем значения в зависимости от найденного идентификатора
                if (relationId && !isNaN(relationId)) {
                    if (relation === 'from') data.from_id = relationId;
                    if (relation === 'to') data.to_id = relationId;
                    if (relation === 'type') data.type_id = relationId;
                    updated = true; // Значение обновлено
                }
            }
        }
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

// ...

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
    }
}).on('error', error => {
    console.error("Ошибка с наблюдателем:", error);
});

// ...


// Обработка существующих директорий при старте
const initialScan = (dirPath) => {
    if (fs.existsSync(dirPath)) {
        const subDirs = fs.readdirSync(dirPath).filter(name => fs.statSync(path.join(dirPath, name)).isDirectory());
        for (const subDir of subDirs) {
            const subDirPath = path.join(dirPath, subDir);
            processChanges(subDirPath);
            initialScan(subDirPath);
        }
    }
};

// Начальный обход существующих директорий
initialScan(dirPath);
console.log("Наблюдатель запущен. Отслеживание изменений...");
