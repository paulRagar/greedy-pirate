'use client';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface Props {
   showModal: boolean;
   onClose: (e: any) => void;
   closeOnBackdropClick?: boolean;
   children?: React.ReactNode;
}

const Modal = ({ showModal, onClose, closeOnBackdropClick = true, children }: Props) => {
   if (showModal)
      return createPortal(
         <>
            <div
               onClick={(e: any) => {
                  closeOnBackdropClick && onClose(e);
               }}
               className='absolute top-0 left-0 w-screen h-screen bg-black opacity-50 dark:opacity-75'></div>
            <div className='absolute left-[50%] top-[50%] transform translate-x-[-50%] translate-y-[-50%] rounded bg-gray-50 dark:bg-slate-600'>
               {children}
            </div>
         </>,
         document?.body
      );

   return null;
};

export default Modal;
