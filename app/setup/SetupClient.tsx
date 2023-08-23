'use client';
import ButtonIcon from '@/components/button-icon/ButtonIcon';
import Button from '@/components/button/Button';
import Checkbox from '@/components/checkbox/Checkbox';
import Input from '@/components/input-text/InputText';
import Page from '@/components/page/Page';
import Panel from '@/components/panel/Panel';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface Player {
   id: string;
   name: string;
}

const SetupClient = () => {
   const router = useRouter();
   const ref = useRef<any>(null);

   const [playerName, setPlayerName] = useState<string>('');
   const [players, setPlayers] = useState<Array<Player>>([]);
   const [isEvenGreedier, setIsEvenGreedier] = useState<boolean>(false);

   useEffect(() => {
      const localStorageDataString: string = `${localStorage.getItem('players')}`;
      const playerData: Array<{ id: string; name: string }> = JSON.parse(localStorageDataString);
      if (playerData?.length) {
         setPlayers(playerData);
      }
   }, []);

   const handleAddPlayer = () => {
      if (!playerName?.trim()) return;
      setPlayers((prevState) => {
         return [...prevState, { id: crypto.randomUUID(), name: playerName }];
      });
      setPlayerName('');
      if (ref?.current) {
         ref.current.focus();
      }
   };

   const handleRemovePlayer = (id: string) => {
      setPlayers((prevState) => {
         return [...prevState].filter((player) => player.id !== id);
      });
   };

   const handleKeyPress = (e: any) => {
      if (e.key === 'Enter' && players?.length < 10) handleAddPlayer();
   };

   const handleStartGame = () => {
      localStorage.setItem('players', JSON.stringify(players));
      router.push(`/play-local${isEvenGreedier ? '?evenGreedier=true' : ''}`);
   };

   return (
      <Page>
         <Panel className='flex flex-col gap-4 items-center justify-between'>
            <span className='text-3xl font-semibold text-yellow-500'>Greedy Pirate</span>
            <div className='w-full flex justify-between gap-4'>
               <div className='w-1/2 flex flex-col items-center justify-center gap-2'>
                  <div className='flex flex-col items-center'>
                     <span className='text-lg'>{`Enter Crewmate Name`}</span>
                     <span className='text-sm text-secondary'>{`( 2 to 10 Pirates )`}</span>
                  </div>
                  <div className='w-full pb-2'>
                     <Input
                        ref={ref}
                        type='text'
                        placeholder='Name...'
                        autoFocus
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        onKeyDown={handleKeyPress}
                     />
                  </div>
                  <Button color='teal' size='sm' onClick={handleAddPlayer} disabled={players?.length === 10}>
                     + Add Player
                  </Button>
               </div>
               <div className='w-1/2 flex items-center'>
                  <div className='w-full mb-[-10px] grid grid-cols-2 gap-2 items-center'>
                     {players?.length ? (
                        players.map((player, index) => (
                           <div
                              key={index}
                              className='max-h-[32px] flex justify-between items-center px-2 py-1 rounded bg-gray-200 dark:bg-slate-700'>
                              <span>{player.name}</span>
                              <ButtonIcon
                                 size='xs'
                                 color='transparent'
                                 iconName='XMark'
                                 onClick={() => handleRemovePlayer(player.id)}
                              />
                           </div>
                        ))
                     ) : (
                        <div className='col-span-2 flex justify-center p-2 rounded text-secondary bg-gray-200 dark:bg-slate-700'>
                           <span>{`Yer Ship Be Empty. Add Yer Crew.`}</span>
                        </div>
                     )}
                  </div>
               </div>
            </div>
            <div className='flex justify-center'>
               <div>
                  <Button
                     color='purple'
                     disabled={players?.length < 2 || players?.length > 10 || players.some((player) => !player.name)}
                     onClick={handleStartGame}>
                     Start Game!
                  </Button>
               </div>
            </div>
            <div className='absolute bottom-7 left-20'>
               <Checkbox
                  label={'Even Greedier?'}
                  checked={isEvenGreedier}
                  onChange={(e: any) => {
                     setIsEvenGreedier(!isEvenGreedier);
                  }}
               />
            </div>
         </Panel>
      </Page>
   );
};

export default SetupClient;
