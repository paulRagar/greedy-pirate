'use client';
import Button from '@/components/button/Button';
import Page from '@/components/page/Page';
import Panel from '@/components/panel/Panel';
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
      <Page>
         <Panel>
            <h1 className='font-semibold mb-4'>Greedy Pirate</h1>
            <span className='mb-1 text-secondary'>Choose a Game Mode</span>
            <div className='flex gap-4'>
               <Button color='teal' onClick={() => handleGameChoice('local')}>
                  Local With Friends
               </Button>
               <Button color='purple' onClick={() => handleGameChoice('multiplayer')}>
                  Online Multiplayer
               </Button>
            </div>
         </Panel>
      </Page>
   );
};

export default ChooseGameClient;