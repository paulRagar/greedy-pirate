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
         <Panel className='flex flex-col items-center justify-between'>
            <div className='flex flex-col items-center'>
               <span className='mb-4 text-5xl font-semibold text-yellow-500'>Greedy Pirate</span>
               <span className='mb-1 text-secondary'>Choose a Game Mode</span>
            </div>
            <div className='flex justify-between gap-8 p-4'>
               <div className='w-1/2 flex flex-col items-center justify-between gap-2 rounded bg-gray-200 dark:bg-slate-700'>
                  <div className='p-2 pb-0 flex flex-col items-center'>
                     <span className='text-lg uppercase font-semibold'>Shipmate Duel</span>
                     <span className='text-center text-secondary'>{`Ahoy, mateys! Duel with yer crew, grab coins, but be wary! Too much greed and the pirate card'll send ye overboard!`}</span>
                  </div>
                  <div className='w-full grid'>
                     <Button color='teal' onClick={() => handleGameChoice('local')}>
                        Play Local
                     </Button>
                  </div>
               </div>
               <div className='w-1/2 flex flex-col items-center justify-between gap-2 bg-gray-100 dark:bg-slate-700 cursor-not-allowed'>
                  <div className='p-2 pb-0 flex flex-col items-center opacity-50'>
                     <span className='text-lg uppercase font-semibold'>{`Seafarer's Standoff`}</span>
                     <span className='text-center text-secondary'>{`Set sail against distant foes, stash your loot, but tread lightly! One greedy draw, and you'll be lost in digital seas!`}</span>
                  </div>
                  <div className='w-full grid'>
                     <Button color='purple' onClick={() => handleGameChoice('multiplayer')} disabled>
                        Play Online
                     </Button>
                  </div>
               </div>
            </div>
         </Panel>
      </Page>
   );
};

export default ChooseGameClient;
