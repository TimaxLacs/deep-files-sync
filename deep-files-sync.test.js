test('Test deep file sync', async () => {
    // Импортируйте необходимые модули
    const fs = require('fs');
    const path = require('path');
    const { exec } = require('child_process');
    const { expect } = require('@jest/globals');
  
    // Определите путь к вашей утилите
    const utilityPath = './index.js';
  
    // Определите параметры для вашей утилиты
    const url = 'https://3006-deepfoundation-dev-usj38r207un.ws-eu108.gitpod.io';
    const spaceId = '1008';
    const folderPath = './folder';
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwczovL2hhc3VyYS5pby9qd3QvY2xhaW1zIjp7IngtaGFzdXJhLWFsbG93ZWQtcm9sZXMiOlsibGluayJdLCJ4LWhhc3VyYS1kZWZhdWx0LXJvbGUiOiJsaW5rIiwieC1oYXN1cmEtdXNlci1pZCI6IjEwMDgifSwiaWF0IjoxNzA3NDg1MzMzfQ.1OsqDtt_wMbhnzggNeQGlo8M_xjtHW7VZoggYsP8j-A';

    // Запустите вашу утилиту
    exec(`node ${utilityPath} --url ${url} --space-id ${spaceId} --folder-path ${folderPath} --token ${token}`, async (error, stdout, stderr) => {
        if (error) {
            console.log(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.log(`stderr: ${stderr}`);
            return;
        }
        // Создайте тестовый файл с задержкой
    });
    setTimeout(() => {
        const testFileName = 'testFile.txt';
        const testFilePath = path.join(folderPath, testFileName);
        fs.writeFileSync(testFilePath, 'This is a test file.');
    }, 3000); // Задержка в 5 секунд

    
    // Проверьте, был ли файл добавлен в базу данных
    const { data } = await deep.select({ 
        type_id: 3,
        string: { value: { _eq: testFileName } }
    });
    const fileWasAdded = data.length > 0;

    // Используйте Jest для проверки результата
    expect(fileWasAdded).toBe(true);
});
