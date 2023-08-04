// @ts-ignore
const componentTemplate = ({ componentName, props, interfaces, imports, exports, jsx }, { tpl }) => {
   return tpl`
      import { SVGProps, forwardRef, Ref } from 'react';
      const ${componentName} = (${props}) => (
         ${jsx}
      );
      ${exports};
 `;
};
module.exports = componentTemplate;
