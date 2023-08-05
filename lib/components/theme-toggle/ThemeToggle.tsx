'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import ButtonIcon from '../button-icon/ButtonIcon';

type Props = {};

const ThemeToggle = ({}: Props) => {
   const [isLightTheme, setIsLightTheme] = useState<boolean>(false);
   const [hydrationReady, setHydrationReady] = useState<boolean>(false);

   useEffect(() => {
      if (typeof window !== 'undefined') {
         setHydrationReady(!!window?.document);
      }
   }, []);
   useEffect(() => {
      if (localStorage.theme && localStorage.theme === 'light') {
         setIsLightTheme(true);
      } else {
         setIsLightTheme(false);
      }
   }, []);

   const handleSetTheme = (isLight: boolean) => {
      if (!isLight) {
         document.documentElement.classList.remove('light');
         document.documentElement.classList.add('dark');
         setIsLightTheme(false);
      } else {
         document.documentElement.classList.remove('dark');
         document.documentElement.classList.add('light');
         setIsLightTheme(true);
      }
      localStorage.theme = isLight ? 'light' : 'dark';
   };

   if (hydrationReady) {
      return createPortal(
         <span className='absolute bottom-4 right-4'>
            {isLightTheme ? (
               <ButtonIcon iconName='Moon' color='dark' onClick={() => handleSetTheme(!isLightTheme)} />
            ) : (
               <ButtonIcon iconName='Sun' color='light' onClick={() => handleSetTheme(!isLightTheme)} />
            )}
         </span>,
         document.body
      );
   }

   return null;
};

export default ThemeToggle;
