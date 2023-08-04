import React, { useRef } from 'react';
import { Button, btnColorClasses, btnSizeClasses } from '@/lib/types/button';
import { twMerge } from 'tailwind-merge';
import Spinner from '../spinner/Spinner';

const Button = ({ children, color, size, loading, ...rest }: Button) => {
   return (
      <button
         className={twMerge(`
            group rounded-sm disabled:cursor-not-allowed disabled:opacity-40
            ${color === 'transparent' ? 'text-black dark:text-white' : 'text-white'}
            ${btnSizeClasses[(size as keyof object) || 'md']}
            ${btnColorClasses[(color as keyof object) || 'blue']}
            ${!children && 'min-w-[30px] max-w-[30px] min-h-[30px] max-h-[30px]'}
         `)}
         {...rest}>
         {loading && <Spinner />}
         {!loading && <span className='flex flex-row items-center justify-center'>{children}</span>}
      </button>
   );
};

export default Button;
