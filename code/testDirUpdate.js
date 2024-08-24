import pkg from '@apollo/client/core/core.cjs';
const { ApolloClient, InMemoryCache, split, HttpLink } = pkg;
import { DeepClient, parseJwt } from "@deep-foundation/deeplinks/imports/client.js";
import { WebSocketLink } from '@apollo/client/link/ws/ws.cjs';
import { Concast, getMainDefinition } from '@apollo/client/utilities/utilities.cjs';
import { SubscriptionClient } from 'subscriptions-transport-ws';
import ws from 'ws';
import fs from 'fs';
import path from 'path';
import watch from 'watch';

const dirPath = '/home/timax/Code/Deep-project/deep-files-sync/test';


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
  
  // Рекурсивная функция для обновления значений data.json на основе изменений в других директориях
  const updateDataJsonBasedOnRelations = async (dirPath) => {
    let dataJsonPath = path.join(dirPath, 'data.json');
  
    // Проверяем, существует ли data.json
    if (!fs.existsSync(dataJsonPath)) {
        console.log(`data.json не найден в директории ${dirPath}`);
        return;
    }
  
    const relationDirs = ['in', 'out', 'typed']; // Для поиска в родительских директориях
    const currentRelationDirs = ['from', 'to', 'type']; // Для поиска в текущей директории
    let data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
  
    // Проверка родительских директорий для in, out, typed
    for (const relation of relationDirs) {
        
        const parentRelationPath = path.join(dirPath, relation);
  
  
        // const parentRelationPath = path.join(path.join(parentDir, relation), folderLinkName);
        // Проверяем, существует ли директория, содержащая data.json
        if (fs.existsSync(parentRelationPath) && fs.statSync(parentRelationPath).isDirectory()) {
            // Ищем поддиректории в текущем пути
            const subDirs = fs.readdirSync(parentRelationPath).filter(name => fs.statSync(path.join(parentRelationPath, name)).isDirectory());
              for (const subDir of subDirs) {
                dataJsonPath = path.join(parentRelationPath, subDir, 'data.json');
                if (fs.existsSync(dataJsonPath)) {
                    const relationData = JSON.parse(fs.readFileSync(path.join(dirPath, 'data.json'), 'utf-8'));
                    data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf-8'));
      
                    // Обновляем данные в зависимости от найденного идентификатора
                    if (relationData.id && !isNaN(relationData.id)) {
                        if (relation == 'in') data.to_id = Number(relationData.id); // Обновляем to
                        if (relation == 'out') data.from_id = Number(relationData.id); // Обновляем from
                        if (relation == 'typed') data.type_id = Number(relationData.id); // Обновляем type
                    }
                    break; // Выходим после нахождения первого вхождения
                }
            }
        }
    }
  
    // Проверка текущей директории для from, to, type
    for (const relation of currentRelationDirs) {
        const currentRelationPath = path.join(dirPath, relation);
        //console.log(currentRelationPath, 'currentRelationPath')
        if (fs.existsSync(currentRelationPath) && fs.statSync(currentRelationPath).isDirectory()) {
            // Ищем только первую поддиректорию для получения data.json
            const subDirs = fs.readdirSync(currentRelationPath).filter(name => fs.statSync(path.join(currentRelationPath, name)).isDirectory());
  
            for (const subDir of subDirs) {
                const subDataJsonPath = path.join(currentRelationPath, subDir, 'data.json');
                if (fs.existsSync(subDataJsonPath)) {
                    const relationData = JSON.parse(fs.readFileSync(subDataJsonPath, 'utf-8'));
                    const relationId = relationData.id;
  
                    // Обновляем значения в зависимости от найденного идентификатора
                    if (relationId && !isNaN(relationId)) {
                        if (relation === 'from') data.from_id = Number(relationId);
                        if (relation === 'to') data.to_id = Number(relationId);
                        if (relation === 'type') data.type_id = Number(relationId);
                        break; // Выходим после нахождения первого вхождения
                    }
                }
            }
        }
    }
  
    // Записываем изменения обратно в data.json
    fs.writeFileSync(dataJsonPath, JSON.stringify(data, null, 2));
    console.log(`data.json обновлён в директории: ${dirPath}`);
  };
  
  // Пример использования функции в вашем watchTree
  watch.watchTree(dirPath, async (f, curr, prev) => {
    if (typeof f === 'object' && prev === null && curr === null) {
        return;
    }
    
    const currentDir = path.dirname(f);
    await updateDataJsonBasedOnRelations(currentDir); // Обновляем при каждом изменении
  });
  













  import pkg from '@apollo/client/core/core.cjs';
const { ApolloClient, InMemoryCache, split, HttpLink } = pkg;
import { DeepClient, parseJwt } from "@deep-foundation/deeplinks/imports/client.js";
import { WebSocketLink } from '@apollo/client/link/ws/ws.cjs';
import { Concast, getMainDefinition } from '@apollo/client/utilities/utilities.cjs';
import { SubscriptionClient } from 'subscriptions-transport-ws';
import ws from 'ws';
import fs from 'fs';
import path from 'path';
import watch from 'watch';

const dirPath = '/home/timax/Code/Deep-project/deep-files-sync/test';


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
  
// Функция для обновления значений data.json на основе изменений в других директориях
const updateDataJsonBasedOnRelations = async (dirPath) => {
    let dataJsonPath = path.join(dirPath, 'data.json');

    // Проверяем, существует ли data.json
    if (!fs.existsSync(dataJsonPath)) {
        console.log(`data.json не найден в директории ${dirPath}`);
        return;
    }

    const relationDirs = ['in', 'out', 'typed']; 
    const currentRelationDirs = ['from', 'to', 'type'];
    let data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));

   // Проверка родительских директорий для in, out, typed
   for (const relation of relationDirs) {
        
    const parentRelationPath = path.join(dirPath, relation);


    // const parentRelationPath = path.join(path.join(parentDir, relation), folderLinkName);
    // Проверяем, существует ли директория, содержащая data.json
    if (fs.existsSync(parentRelationPath) && fs.statSync(parentRelationPath).isDirectory()) {
        // Ищем поддиректории в текущем пути
        const subDirs = fs.readdirSync(parentRelationPath).filter(name => fs.statSync(path.join(parentRelationPath, name)).isDirectory());
          for (const subDir of subDirs) {
            dataJsonPath = path.join(parentRelationPath, subDir, 'data.json');
            if (fs.existsSync(dataJsonPath)) {
                const relationData = JSON.parse(fs.readFileSync(path.join(dirPath, 'data.json'), 'utf-8'));
                data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf-8'));
  
                // Обновляем данные в зависимости от найденного идентификатора
                if (relationData.id && !isNaN(relationData.id)) {
                    if (relation == 'in') data.to_id = Number(relationData.id); // Обновляем to
                    if (relation == 'out') data.from_id = Number(relationData.id); // Обновляем from
                    if (relation == 'typed') data.type_id = Number(relationData.id); // Обновляем type
                }
                break; // Выходим после нахождения первого вхождения
            }
        }
    }
}

    // Проверка текущей директории для from, to, type
    for (const relation of currentRelationDirs) {
        const currentRelationPath = path.join(dirPath, relation);
        //console.log(currentRelationPath, 'currentRelationPath')
        if (fs.existsSync(currentRelationPath) && fs.statSync(currentRelationPath).isDirectory()) {
            // Ищем только первую поддиректорию для получения data.json
            const subDirs = fs.readdirSync(currentRelationPath).filter(name => fs.statSync(path.join(currentRelationPath, name)).isDirectory());
  
            for (const subDir of subDirs) {
                const subDataJsonPath = path.join(currentRelationPath, subDir, 'data.json');
                if (fs.existsSync(subDataJsonPath)) {
                    const relationData = JSON.parse(fs.readFileSync(subDataJsonPath, 'utf-8'));
                    const relationId = relationData.id;
  
                    // Обновляем значения в зависимости от найденного идентификатора
                    if (relationId && !isNaN(relationId)) {
                        if (relation === 'from') data.from_id = Number(relationId);
                        if (relation === 'to') data.to_id = Number(relationId);
                        if (relation === 'type') data.type_id = Number(relationId);
                        break; // Выходим после нахождения первого вхождения
                    }
                }
            }
        }
    }

    // Записываем изменения обратно в data.json
    fs.writeFileSync(dataJsonPath, JSON.stringify(data, null, 2));
    console.log(`data.json обновлён в директории: ${dirPath}`);

    // Синхронизация названий папок с id и type_id
    syncFolderNamesWithIds(data, dirPath);
};

// Функция для синхронизации имен папок с id и type_id
const syncFolderNamesWithIds = (data, dirPath) => {
    const newIdName = data.id ? data.id.toString() : '';
    const newTypeIdName = data.type_id ? data.type_id.toString() : '';

    const newFolderName = `${newIdName}__${newTypeIdName}`;
    const currentFolderName = path.basename(dirPath);
    
    // Проверяем, изменилось ли имя папки
    if (currentFolderName !== newFolderName) {
        const parentDir = path.dirname(dirPath);
        const newPath = path.join(parentDir, newFolderName);

        // Переименовываем папку
        fs.renameSync(dirPath, newPath);
        console.log(`Папка переименована с ${currentFolderName} на ${newFolderName}`);
    }
};

// Обработка изменения названия между папками
watch.watchTree(dirPath, async (f, curr, prev) => {
    if (typeof f === 'object' && prev === null && curr === null) {
        return;
    }

    const currentDir = path.dirname(f);
    await updateDataJsonBasedOnRelations(currentDir); // Обновляем при каждом изменении
});
