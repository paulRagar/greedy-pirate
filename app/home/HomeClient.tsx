'use client';
import Button from '@/components/button/Button';
import Page from '@/components/page/Page';
import Panel from '@/components/panel/Panel';
import { useRouter } from 'next/navigation';

const HomeClient = () => {
   const router = useRouter();

   const handlePlay = () => {
      router.push('/choose-game');
   };
   return (
      <Page>
         <Panel className='flex flex-col items-center justify-between'>
            <span className='mb-4 text-5xl font-semibold text-yellow-500'>Greedy Pirate</span>
            <span className='p-2 text-xl text-center bg-gray-100 dark:bg-slate-700'>{`Embark on a thrilling voyage with Greedy Pirate, where a treasure of coins awaits, but beware - one wrong card could plunder your loot in this high-stakes, risk-and-reward browser card game!`}</span>
            <Button onClick={handlePlay} color='purple'>
               Set Sail
            </Button>
         </Panel>
      </Page>
   );
};

export default HomeClient;
