import React from 'react';
import { Colors } from './colors';
import { IconNames } from './icon';

export const buttonSizeClasses: ColorObjectType = {
   xs: 'min-h-[24px] max-h-[24px] px-[10px] text-[13px]',
   sm: 'min-h-[30px] max-h-[30px] px-[20px] text-[14px]',
   md: 'min-h-[40px] max-h-[40px] px-[20px] text-[14px]',
   lg: 'min-h-[50px] max-h-[50px] px-[24px] text-[18px]',
   xl: 'min-h-[60px] max-h-[60px] px-[24px] text-[20px]',
};

export const iconButtonSizeClasses: ColorObjectType = {
   xs: 'min-h-[24px] max-h-[24px] min-w-[24px] max-w-[24px]',
   sm: 'min-h-[30px] max-h-[30px] min-w-[30px] max-w-[30px]',
   md: 'min-h-[40px] max-h-[40px] min-w-[40px] max-w-[40px]',
   lg: 'min-h-[50px] max-h-[50px] min-w-[50px] max-w-[50px]',
   xl: 'min-h-[60px] max-h-[60px] min-w-[60px] max-w-[60px]',
};

export const iconSize = {
   xs: 12,
   sm: 16,
   md: 18,
   lg: 20,
   xl: 22,
};

export const buttonColorClasses: ColorObjectType = {
   blue: 'bg-blue-500 enabled:hover:bg-blue-400 enabled:active:bg-blue-600',
   green: 'bg-green-500 enabled:hover:bg-green-400 enabled:active:bg-green-600',
   orange: 'bg-orange-500 enabled:hover:bg-orange-400 enabled:active:bg-orange-600',
   red: 'bg-red-500 enabled:hover:bg-red-400 enabled:active:bg-red-600',
   purple: 'bg-purple-500 enabled:hover:bg-purple-400 enabled:active:bg-purple-600',
   pink: 'bg-pink-500 enabled:hover:bg-pink-400 enabled:active:bg-pink-600',
   cyan: 'bg-cyan-500 enabled:hover:bg-cyan-400 enabled:active:bg-cyan-600',
   teal: 'bg-teal-500 enabled:hover:bg-teal-400 enabled:active:bg-teal-600',
   dark: 'bg-stone-700 enabled:hover:bg-stone-600 enabled:active:bg-stone-800 dark:bg-stone-800 dark:hover:bg-stone-700 dark:active:bg-stone-800',
   mid: 'bg-stone-500 enabled:hover:bg-stone-400 enabled:active:bg-stone-600',
   light: 'bg-gray-100 enabled:hover:bg-gray-50 enabled:active:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500 dark:active:bg-gray-600',
   transparent: 'bg-transparent enabled:hover:bg-transparent enabled:active:bg-transparent',
   none: 'bg-gray-400 enabled:hover:bg-gray-300 enabled:active:bg-gray-500',
};

type ColorObjectType = {
   [color: string]: string;
};
export interface DefaultButton {
   color?: Colors;
   size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
   onClick?: (e: any) => void;
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
