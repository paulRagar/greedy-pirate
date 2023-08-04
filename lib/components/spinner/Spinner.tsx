import React from 'react';
import { twMerge } from 'tailwind-merge';

interface Props {
   className?: string;
}
const Spinner = ({ className }: Props) => {
   return (
      <svg
         className={twMerge(`
      animate-spin stroke-stone-500 h-6 w-6 m-auto
      ${className ? className : ''}
  `)}
         height='1em'
         viewBox='0 0 512 512'>
         <path d='M304 48a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zm0 416a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zM48 304a48 48 0 1 0 0-96 48 48 0 1 0 0 96zm464-48a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zM142.9 437A48 48 0 1 0 75 369.1 48 48 0 1 0 142.9 437zm0-294.2A48 48 0 1 0 75 75a48 48 0 1 0 67.9 67.9zM369.1 437A48 48 0 1 0 437 369.1 48 48 0 1 0 369.1 437z' />
      </svg>
   );
};

export default Spinner;
