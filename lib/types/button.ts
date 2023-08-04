import React from 'react';
import { Colors } from './colors';
import { IconNames } from './icon';

export const btnSizeClasses = {
   xs: 'min-h-[24px] py-[10px] px-[10px] text-[13px]', // max-h-[24px]
   sm: 'min-h-[30px] py-[10px] px-[20px] text-[14px]', // max-h-[30px]
   md: 'min-h-[42px] py-[10px] px-[20px] text-[14px]', // max-h-[40px]
   lg: 'min-h-[50px] py-[10px] px-[24px] text-[18px]', // max-h-[50px]
};

export const btnColorClasses = {
   blue: 'bg-blue-500 enabled:hover:bg-blue-400 enabled:active:bg-blue-600',
   green: 'bg-green-500 enabled:hover:bg-green-400 enabled:active:bg-green-600',
   orange: 'bg-orange-500 enabled:hover:bg-orange-400 enabled:active:bg-orange-600',
   red: 'bg-red-500 enabled:hover:bg-red-400 enabled:active:bg-red-600',
   cyan: 'bg-cyan-500 enabled:hover:bg-cyan-400 enabled:active:bg-cyan-600',
   teal: 'bg-teal-500 enabled:hover:bg-teal-400 enabled:active:bg-teal-600',
   dark: 'bg-stone-700 enabled:hover:bg-stone-600 enabled:active:bg-stone-800 dark:bg-stone-800 dark:hover:bg-stone-700 dark:active:bg-stone-800',
   light: 'bg-gray-100 enabled:hover:bg-gray-50 enabled:active:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500 dark:active:bg-gray-600',
   transparent: 'bg-transparent enabled:hover:bg-transparent enabled:active:bg-transparent',
};

interface DefaultButton {
   size?: 'xs' | 'sm' | 'md' | 'lg';
   loading?: boolean;
}

export interface Button extends DefaultButton {
   children: React.ReactNode;
   color?: Colors;
}

export interface ButtonIcon extends DefaultButton {
   children?: React.ReactNode;
   color?: Colors;
   iconName: IconNames;
   iconSize?: number;
}
