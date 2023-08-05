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
         <Panel>
            <h1 className='font-semibold mb-4 bg-purp'>Greedy Pirate</h1>
            <Button onClick={handlePlay} color='purple'>
               Start Game
            </Button>
         </Panel>
      </Page>
   );
};

export default HomeClient;
