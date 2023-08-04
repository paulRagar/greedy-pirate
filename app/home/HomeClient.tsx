'use client';
import { useRouter } from 'next/navigation';

const HomeClient = () => {
   const router = useRouter();

   const handlePlay = () => {
      router.push('/choose-game');
   };
   return (
      <div className='absolute left-[50%] top-[50%] transform translate-x-[-50%] translate-y-[-50%]'>
         <div className='flex flex-col items-center p-4 rounded shadow-lg bg-white'>
            <h1 className='font-semibold mb-4'>Nut Nut Squirrel</h1>
            <button
               onClick={handlePlay}
               className='w-full py-2 px-4 rounded bg-green-500 disabled:bg-slate-300  text-white cursor-pointer disabled:cursor-not-allowed'>{`Let's Play!`}</button>
         </div>
      </div>
   );
};

export default HomeClient;
