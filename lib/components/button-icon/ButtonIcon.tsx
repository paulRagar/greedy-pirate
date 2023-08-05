import React from 'react';
import { buttonColorClasses, DefaultButton, iconButtonSizeClasses } from '@/lib/types/button';
import { twMerge } from 'tailwind-merge';
import Icon from '../icon/Icon';
import Spinner from '../spinner/Spinner';
import { IconNames } from '@/types/icon';

export interface ButtonIcon extends DefaultButton {
   iconName: IconNames;
   iconSize?: number;
}

const ButtonIcon = ({
   color,
   size,
   onClick,
   iconName,
   iconSize,
   loading,
   ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & ButtonIcon) => {
   return (
      <button
         className={twMerge(`
            group rounded-sm disabled:cursor-not-allowed disabled:opacity-40
            ${color === 'transparent' ? 'text-slate-700 dark:text-white' : 'text-white'}
            ${iconButtonSizeClasses[(size as keyof object) || 'md']}
            ${buttonColorClasses[(color as keyof object) || 'none']}
         `)}
         onClick={(e) => {
            e.preventDefault();
            onClick && onClick(e);
         }}
         {...rest}>
         {loading && <Spinner />}
         {!loading && (
            <span className='flex flex-row items-center justify-center'>
               <Icon
                  name={iconName || 'NotAllowed'}
                  width={`${iconSize || 16}`}
                  height={`${iconSize || 16}`}
                  className={twMerge(`
                     ${color === 'transparent' ? 'fill-black dark:fill-white' : 'fill-white'}
                  `)}
               />
            </span>
         )}
      </button>
   );
};

export default ButtonIcon;
