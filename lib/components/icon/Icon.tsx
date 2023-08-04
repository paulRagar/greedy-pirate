import React from 'react';
import * as icons from '../icons';
import { twMerge } from 'tailwind-merge';
import { iconColorClasses, IconNames } from '@/types/icon';
import { Colors } from '@/types/colors';

interface Props {
   name: IconNames;
   color?: Colors;
}

const Icon = ({ name, color = 'blue', ...rest }: React.SVGProps<SVGSVGElement> & Props): JSX.Element | any => {
   if (icons && icons[name as keyof object])
      return React.createElement(icons[name as keyof object], {
         className: twMerge(`
            ${iconColorClasses[color as keyof object]}
         `),
         ...rest,
      });
   return null;
};

export default Icon;
