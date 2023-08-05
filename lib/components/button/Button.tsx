import React from 'react';
import { twMerge } from 'tailwind-merge';
import { useRouter } from 'next/navigation';
import { buttonColorClasses, DefaultButton, iconSize } from '@/types/button';
import Icon from '../icon/Icon';
import { IconNames } from '@/types/icon';

export type ButtonSizes = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface Button extends DefaultButton {
   iconName?: IconNames;
   children?: React.ReactNode;
}

type Props = {
   children?: React.ReactNode;
   onClick?: (e: any) => void;
};

const Button = ({
   color = 'none',
   size,
   iconName,
   onClick,
   children,
   ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & Button) => {
   const router = useRouter();

   const buttonSizeClasses = {
      xs: 'min-h-[24px] max-h-[24px] px-[10px] text-[13px]',
      sm: 'min-h-[30px] max-h-[30px] px-[20px] text-[14px]',
      md: 'min-h-[40px] max-h-[40px] px-[20px] text-[14px]',
      lg: 'min-h-[50px] max-h-[50px] px-[24px] text-[18px]',
      xl: 'min-h-[60px] max-h-[60px] px-[24px] text-[20px]',
   };
   const iconButtonSizeClasses = {
      xs: 'min-h-[24px] max-h-[24px] min-w-[24px] max-w-[24px]',
      sm: 'min-h-[30px] max-h-[30px] min-w-[30px] max-w-[30px]',
      md: 'min-h-[40px] max-h-[40px] min-w-[40px] max-w-[40px]',
      lg: 'min-h-[50px] max-h-[50px] min-w-[50px] max-w-[50px]',
      xl: 'min-h-[60px] max-h-[60px] min-w-[60px] max-w-[60px]',
   };

   return (
      <button
         className={twMerge(`
               group rounded-sm text-white disabled:cursor-not-allowed disabled:opacity-25
               ${children && buttonSizeClasses[size || 'md']}
               ${!children && iconButtonSizeClasses[size || 'sm']}
               ${buttonColorClasses[color] || buttonColorClasses['none']}
            `)}
         onClick={(e) => {
            e.preventDefault();
            onClick && onClick(e);
         }}
         {...rest}>
         <span className='flex items-center justify-center'>
            {iconName && (
               <Icon
                  name={iconName || 'Warning'}
                  width={iconSize[size || 'sm']}
                  height={iconSize[size || 'sm']}
                  className={twMerge(`fill-white
                     m-auto
                     ${children && 'mr-[5px]'}
                     ${
                        color === 'transparent' &&
                        'fill-gray-400 group-hover:fill-gray-500 group-active:fill-gray-500 dark:group-hover:fill-gray-200'
                     }
                  `)}
               />
            )}
            {children}
         </span>
      </button>
   );
};

export default Button;
