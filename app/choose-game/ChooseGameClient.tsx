'use client';
import { useRouter } from 'next/navigation';

type Props = {};

const ChooseGameClient = ({}: Props) => {
   const router = useRouter();

   const handleGameChoice = (gameType: string) => {
      if (gameType === 'multiplayer') {
         router.push('/wait');
      } else {
         router.push('/setup');
      }
   };

   return (
      <div className='absolute left-[50%] top-[50%] transform translate-x-[-50%] translate-y-[-50%]'>
         <div className='flex flex-col items-center p-4 rounded shadow-lg bg-white'>
            <h1 className='font-semibold mb-4'>Nut Nut Squirrel</h1>
            <span className='mb-1 text-slate-500'>Please Choose a Game Mode</span>
            <div className='flex gap-4'>
               <button
                  onClick={() => handleGameChoice('local')}
                  className='py-2 px-4 rounded bg-green-500 disabled:bg-slate-300  text-white cursor-pointer disabled:cursor-not-allowed'>
                  Local With Friends
               </button>
               <button
                  onClick={() => handleGameChoice('multiplayer')}
                  className='py-2 px-4 rounded bg-blue-500 disabled:bg-slate-300  text-white cursor-pointer disabled:cursor-not-allowed'>
                  Online Multiplayer
               </button>
            </div>
         </div>
      </div>
   );
};

export default ChooseGameClient;
