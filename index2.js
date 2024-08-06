import { DeepClient, parseJwt } from "@deep-foundation/deeplinks/imports/client.js";
import { generateApolloClient } from "@deep-foundation/hasura/client.js";
import fs from 'fs';
import path from 'path';
import watch from 'watch';

// Параметры подключения и инициализация клиента
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwczovL2hhc3VyYS5pL2NsbGltcyOluYXNtLWFsbG93ZWQtcm9sZXMiOlsiYWRtaW4iXSwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoiYWRtaW4iLCJ4LWhhc3VyYS11c2VyLWlkIjoiMzgwIn0sImlhdCI6MTcyMTAyNDQ1Mn0.5-dmguj7gaue0M8RTxkPPtyJ2p231UKvK_JjBgkRGU4';
const GQL_URN = '3006-timaxlacs-dev-p4ivkibqc0z.ws-eu115.gitpod.io/gql';
const dirPath = '/home/timax/Code/Deep-project/deep-files-sync/test';
const GQL_SSL = true;

const makeDeepClient = token => {
    if (!token) throw new Error("No token provided");
    try {
        const decoded = parseJwt(token);
        const linkId = decoded.userId;
        const apolloClient = generateApolloClient({
            path: GQL_URN,
            ssl: !!+GQL_SSL,
            token
        });
        const deepClient = new DeepClient({ apolloClient, linkId, token });
        console.log('DeepClient успешно создан');
        return deepClient;
    } catch (error) {
        console.error('Ошибка при создании DeepClient:', error);
        throw error;
    }
}

let deep;

try {
    deep = makeDeepClient(token);
} catch (error) {
    console.error('Не удалось создать DeepClient:', error);
    process.exit(1);
}

// Функция для создания файла
const createFile = (filePath, content = '') => {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, content, { flag: 'w' }, (err) => {
            if (err) throw err;
        });
    }
}

// Функция для создания папки
const createDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// Функция для создания папки, если она не существует
const createDirectory = (dirPath) => {
    return new Promise((resolve, reject) => {
        fs.mkdir(dirPath, { recursive: true }, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

// Функция для обработки результатов и создания структуры папок
const processResults = async (result, currentDir) => {
    const processRelation = async (relations, parentDir) => {
        for (const relation of Object.keys(relations)) {
            const relationDir = path.join(parentDir, relation);
            await createDirectory(relationDir);
            for (const link of relations[relation]) {
                const linkDir = path.join(relationDir, link.linkId.toString());
                await createDirectory(linkDir);
                if (typeof link === 'object' && Object.keys(link).length > 1) {
                    await processRelation(link, linkDir);
                }
            }
        }
    };

    await processRelation(result, currentDir);
};

// Функция для обработки содержимого eval.js
const executeEvalFile = async (evalPath, currentDir) => {
    fs.readFile(evalPath, 'utf8', async (err, data) => {
        if (err) throw err;
        try {
            // Определяем linkId для текущей папки (если папка связи)
            let linkId = null;
            const parts = path.basename(currentDir).split('_');
            if (parts.length >= 3) {
                linkId = parseInt(parts[0]);
            }

            // Вызываем функцию из eval.js
            const queryFunction = new Function('deep', 'linkId', `return (async () => { return ${data} })()`);
            const result = await queryFunction(deep, linkId);

            // Если результат есть, обрабатываем структуру папок
            if (result) {
                await processResults(result, currentDir);
            }

        } catch (error) {
            console.error('Ошибка при выполнении eval.js:', error);
            createFile(path.join(currentDir, 'stop'));
        }
    });
}

// Функция для получения названия связи
const getLinkName = async (linkId) => {
    const result = await deep.select({
        type_id: 3,
        to_id: linkId
    });

    if (result.data.length > 0) {
        return result.data[0].value.value;
    }

    return '';
}

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

// Запуск синхронизации при старте скрипта
(async () => {
    const evalPath = path.join(dirPath, 'eval.js');
    await executeEvalFile(evalPath, dirPath);
})();
