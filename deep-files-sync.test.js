//import { DeepClient, parseJwt } from "@deep-foundation/deeplinks/imports/client.js";

test('Test deep file sync', async () => {
    // Импортируйте необходимые модули
    const fs = require('fs');
    const path = require('path');
    const { exec } = require('child_process');
    const { expect } = require('@jest/globals');
  
    // Определите путь к вашей утилите
    const utilityPath = './index.js';
  
    // Определите параметры для вашей утилиты
    const spaceId = '1008';
    const folderPath = './folder';
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwczovL2hhc3VyYS5pby9qd3QvY2xhaW1zIjp7IngtaGFzdXJhLWFsbG93ZWQtcm9sZXMiOlsibGluayJdLCJ4LWhhc3VyYS1kZWZhdWx0LXJvbGUiOiJsaW5rIiwieC1oYXN1cmEtdXNlci1pZCI6IjEwMDgifSwiaWF0IjoxNzA3NDg1MzMzfQ.1OsqDtt_wMbhnzggNeQGlo8M_xjtHW7VZoggYsP8j-A';
    let urn = 'https://3006-deepfoundation-dev-usj38r207un.ws-eu108.gitpod.io';
    let ssl;
    
    const url_protocol = urn.match(/^(http:|https:)/)[0];
    if (url_protocol === "https:") {
      ssl = true;
    } else if (url_protocol === "http:") {
      ssl = false;
    } else {
      throw new Error(`Unsupported protocol: ${url.protocol}`);
    }
    
    if (!urn.endsWith("/gql")) {
      urn += "/gql";
    }
    urn = urn.replace(/^https:\/\//, "");
    urn.replace(/^http:\/\//, "");
    
    const GQL_URN = process.env.GQL_URN || urn
    const GQL_SSL = process.env.GQL_SSL || ssl;


    const makeDeepClient = token => {
        if (!token) throw new Error("No token provided")
        const decoded = parseJwt(token)
        const linkId = decoded.userId
        const apolloClient = generateApolloClient({
          path: GQL_URN,
          ssl: !!+GQL_SSL,
          token
        })
        const deepClient = new DeepClient({ apolloClient, linkId, token })
        //console.log(deepClient);
        return deepClient
      }
    
    deep = makeDeepClient(token);


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

        const { data } = deep.select({ 
            type_id: 3,
            string: { value: { _eq: testFileName } }
        });
        const fileWasAdded = data.length > 0;
    
        // Используйте Jest для проверки результата
        expect(fileWasAdded).toBe(true);

    }, 3000); // Задержка в 5 секунд

    
    // Проверьте, был ли файл добавлен в базу данных
    

});
