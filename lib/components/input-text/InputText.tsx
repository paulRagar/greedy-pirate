import React from 'react';
import { twMerge } from 'tailwind-merge';
import { IconNames } from '@/types/icon';
import Icon from '../icon/Icon';
import Button from '../button/Button';

export interface InputText {
   label?: string;
   iconName?: IconNames;
   errorMessage?: string;
   required?: boolean;
   textCentered?: boolean;
   border?: boolean;
   shadow?: boolean;
   onChange?: (e: any) => void;
   onClearInput?: (e: any) => void;
}

const Input = React.forwardRef(
   (
      {
         label,
         iconName,
         errorMessage,
         required,
         textCentered,
         border = true,
         shadow = false,
         onChange,
         onClearInput,
         ...rest
      }: React.InputHTMLAttributes<HTMLInputElement> & InputText,
      ref: any
   ) => {
      const labelHtmlFor = label ? label.replace(' ', '-').toLowerCase() : '';

      return (
         <label className='relative block' htmlFor={labelHtmlFor}>
            {label && (
               <>
                  <span className='text-sm text-secondary'>
                     {label}
                     {required && <span className='pl-[3px]'>*</span>}
                  </span>
               </>
            )}
            <div className='flex items-center'>
               {iconName && (
                  <Icon
                     className='absolute left-[10px] fill-gray-300 dark:fill-gray-450'
                     name={iconName || 'NotAllowed'}
                     height='16'
                     width='16'
                  />
               )}
               <input
                  ref={ref}
                  className={twMerge(`
                        w-full min-h-[40px] max-h-[40px] p-[10px] rounded
                     bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white placeholder:text-gray-400 border-[1px] border-solid
                        ${!border && 'border-none'}
                        ${shadow && 'shadow-012'}
                        ${iconName && 'pl-[36px]'}
                        ${
                           errorMessage
                              ? 'border-[1px] border-solid border-red-500'
                              : 'border-gray-100 dark:border-gray-600'
                        }
                        ${textCentered && 'text-center'}
                        ${rest?.disabled && 'opacity-70 hover:cursor-not-allowed text-gray-400'}
                     `)}
                  type='text'
                  id={labelHtmlFor}
                  required={required}
                  onChange={(e: any) => {
                     onChange && onChange(e);
                  }}
                  {...rest}
               />
               {onClearInput && !!`${rest?.value}`?.length && (
                  <span className={'absolute right-[10px]'}>
                     <Button
                        onClick={(e: any) => onClearInput && onClearInput(e)}
                        color='transparent'
                        size='xs'
                        iconName='XMark'
                     />
                  </span>
               )}
            </div>
            {errorMessage && (
               <div className='flex pt-[6px]'>
                  <Icon
                     className='min-w-[11px] min-h-[11px] fill-red-500'
                     name='Warning'
                     height='11'
                     width='11'
                     viewBox='0 0 16 16'
                  />
                  <span className='mt-[-3px] pl-[6px] text-[11px] leading-[14px] text-gray-600 dark:text-gray-300'>
                     {errorMessage}
                  </span>
               </div>
            )}
         </label>
      );
   }
);

Input.displayName = 'Input'; // Need to add component displayName manually if setting component to React.forwardRef()

export default Input;
