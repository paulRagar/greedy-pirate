//@ts-ignore
const fs = require('fs');
//@ts-ignore
const path = require('path');

function readDirectory(directoryPath: string): Promise<string[]> {
   return new Promise((resolve, reject) => {
      fs.readdir(directoryPath, (error: any, filenames: any) => {
         if (error) {
            reject(error);
         } else {
            resolve(filenames);
         }
      });
   });
}

function readFile(filePath: string): Promise<string> {
   return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (error: any, data: any) => {
         if (error) {
            reject(error);
         } else {
            resolve(data);
         }
      });
   });
}

function writeFile(filePath: string, data: string): Promise<void> {
   return new Promise((resolve, reject) => {
      fs.writeFile(filePath, data, (error: any) => {
         if (error) {
            reject(error);
         } else {
            resolve();
         }
      });
   });
}

async function generateIconTypes() {
   try {
      const dirPath = './lib/components/icons';
      const filenames = await readDirectory(dirPath);
      const types: Array<string | undefined> = filenames
         .map((fileName: string) => {
            const typeName = path.parse(fileName).name;
            if (typeName === 'index') return;
            return `"${typeName}"`;
         })
         .filter((type: any) => type);

      const typeDefinition = `export type IconNames = ${types.join(' | ')};`;

      const targetFilePath = './lib/types/icon.ts';

      let targetFileContent = await readFile(targetFilePath);
      if (targetFileContent.includes('export type IconNames')) {
         targetFileContent = targetFileContent.replace(/export type IconNames .*?;/s, typeDefinition);
      } else {
         targetFileContent += '\n\n' + typeDefinition;
      }

      await writeFile(targetFilePath, targetFileContent);
      console.log('Generated icon type name definition(s)!');
   } catch (err: any) {
      console.log('Error generating icon name type definition(s)...', err);
   }
}

generateIconTypes();
