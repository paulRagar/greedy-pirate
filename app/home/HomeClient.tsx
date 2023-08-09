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
         <Panel className='flex flex-col items-center'>
            <span className='mb-4 text-3xl font-semibold text-yellow-500'>Greedy Pirate</span>
            <Button onClick={handlePlay} color='purple'>
               Start Game
            </Button>
         </Panel>
      </Page>
   );
};

export default HomeClient;
