// @ts-ignore
const path = require('path');

// @ts-ignore
const defaultIndexTemplate = (filePaths) => {
   // @ts-ignore
   const exportEntries = filePaths.map((filePath) => {
      const basename = path.basename(filePath.path, path.extname(filePath.path));
      const exportName = /^\d/.test(basename) ? `Svg${basename}` : basename;
      return `export { default as ${exportName} } from './${basename}'`;
   });
   return exportEntries.join('\n');
};

module.exports = defaultIndexTemplate;
