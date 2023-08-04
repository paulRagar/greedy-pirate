import React, { useRef } from 'react';
import { ButtonIcon, btnColorClasses, btnSizeClasses } from '@/lib/types/button';
import { useButton, AriaButtonProps } from 'react-aria';
import { twMerge } from 'tailwind-merge';
import Icon from '../icon/Icon';
import Spinner from '../spinner/Spinner';

const ButtonIcon = ({ children, color, size, iconName, iconSize, loading, ...rest }: ButtonIcon & AriaButtonProps) => {
   let ref = useRef(null);
   let { buttonProps } = useButton(rest, ref);

   return (
      <button
         ref={ref}
         {...buttonProps}
         className={twMerge(`
            group rounded-sm disabled:cursor-not-allowed disabled:opacity-40
            ${color === 'transparent' ? 'text-black dark:text-white' : 'text-white'}
            ${btnSizeClasses[(size as keyof object) || 'md']}
            ${btnColorClasses[(color as keyof object) || 'blue']}
         `)}>
         {loading && <Spinner />}
         {!loading && (
            <span className='flex flex-row items-center justify-center'>
               <Icon
                  name={iconName || 'Calendar'}
                  width={`${iconSize || 16}`}
                  height={`${iconSize || 16}`}
                  className={twMerge(`
                     ${children && 'mr-[5px]'}
                     ${color === 'transparent' ? 'fill-black dark:fill-white' : 'fill-white'}
                  `)}
               />
               {children}
            </span>
         )}
      </button>
   );
};

export default ButtonIcon;
