import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';

// Корневой путь
const dirPath = '/home/timax/Code/Deep-project/deep-files-sync/test';

// Проверка существования data.json
const dataJsonExists = (filePath) => fs.existsSync(filePath);

// Обновление data.json
const updateDataJson = (dirPath, data) => {
    const dataJsonPath = path.join(dirPath, 'data.json');

    if (dataJsonExists(dataJsonPath)) {
        const currentData = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));

        // Обновление только если есть изменения
        if (currentData.id !== data.id || currentData.type_id !== data.type_id || currentData.from_id !== data.from_id || currentData.to_id !== data.to_id) {
            fs.writeFileSync(dataJsonPath, JSON.stringify(data, null, 2));
            console.log("data.json обновлён в директории: " + dirPath);
        }
    } else {
        console.log("data.json не найден в директории: " + dirPath);
    }
};

// Функция для синхронизации имен папок с id и type_id
const syncFolderNamesWithIds = (dirPath) => {
    const currentFolderName = path.basename(dirPath);
    const parts = currentFolderName.split('__');

    // Проверка, что папка имеет нужный формат
    if (parts.length < 2) return;

    const id = Number(parts[0]);
    const typeId = Number(parts[parts.length - 1]);

    const dataJsonPath = path.join(dirPath, 'data.json'); 

    if (dataJsonExists(dataJsonPath)) {
        let data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));

        // Сравнение чтобы избежать бесконечной рекурсии
        if (data.id !== id || data.type_id !== typeId) {
            data.id = id;
            data.type_id = typeId;
            updateDataJson(dirPath, data); // Обновляем data.json
        }
    }
};

// Функция для обновления данных в data.json из других папок
const updateDataFromRelations = (dirPath, data) => {
    const relationTypes = ['in', 'out', 'typed', 'from', 'to', 'type'];

    for (const relation of ['in', 'out', 'typed']) {
        const currentRelationPath = path.join(path.dirname(dirPath), relation);
        if (dataJsonExists(currentRelationPath) && fs.statSync(currentRelationPath).isDirectory()) {
            const subDirs = fs.readdirSync(currentRelationPath).filter(name => fs.statSync(path.join(currentRelationPath, name)).isDirectory());

            for (const subDir of subDirs) {
                const subDataJsonPath = path.join(currentRelationPath, subDir, 'data.json');
                if (dataJsonExists(subDataJsonPath)) {
                    const relationData = JSON.parse(fs.readFileSync(subDataJsonPath, 'utf-8'));
                    if (relationData.id) {
                        if (relation === 'in') data.to_id = relationData.id;
                        if (relation === 'out') data.from_id = relationData.id;
                        if (relation === 'typed') data.type_id = relationData.id;
                        break;
                    }
                }
            }
        }
    }

    for (const relation of ['from', 'to', 'type']) {
        const currentRelationPath = path.join(dirPath, relation);
        if (dataJsonExists(currentRelationPath) && fs.statSync(currentRelationPath).isDirectory()) {
            const subDirs = fs.readdirSync(currentRelationPath).filter(name => fs.statSync(path.join(currentRelationPath, name)).isDirectory());

            for (const subDir of subDirs) {
                const subDataJsonPath = path.join(currentRelationPath, subDir, 'data.json');
                if (dataJsonExists(subDataJsonPath)) {
                    const relationData = JSON.parse(fs.readFileSync(subDataJsonPath, 'utf-8'));
                    if (relationData.id) {
                        if (relation === 'from') data.from_id = relationData.id;
                        if (relation === 'to') data.to_id = relationData.id;
                        if (relation === 'type') data.type_id = relationData.id;
                        break;
                    }
                }
            }
        }
    }
};

const processChanges = (dirPath) => {
    const dataJsonPath = path.join(dirPath, 'data.json');

    if (!dataJsonExists(dataJsonPath)) {
        console.log("data.json не найден в директории: " + dirPath);
        return;
    }

    // Сначала синхронизируем имена папок с id и type_id
    syncFolderNamesWithIds(dirPath);

    let data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
    
    // Обновляем data с помощью других папок
    updateDataFromRelations(dirPath, data);

    // Наконец, обновляем data.json, если необходимо
    updateDataJson(dirPath, data);
};

// Настройка наблюдателя на изменения
const watcher = chokidar.watch(dirPath, { persistent: true });

watcher.on('rename', (oldPath, newPath) => {
    console.log(`Папка переименована с ${oldPath} на ${newPath}`);
    setTimeout(() => processChanges(path.dirname(newPath)), 100);
}).on('addDir', path1 => {
    if (!path.basename(path1).startsWith(".")) {
        console.log(`Папка добавлена: ${path1}`);
        setTimeout(() => processChanges(path1), 100);
    }
}).on('change', path1 => {
    if (!path.basename(path1).startsWith(".")) {
        console.log(`Изменение: ${path1}`);
        setTimeout(() => processChanges(path.dirname(path1)), 100);
    }
}).on('error', error => {
    console.error("Ошибка с наблюдателем:", error);
});

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
