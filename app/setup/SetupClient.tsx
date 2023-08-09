'use client';
import ButtonIcon from '@/components/button-icon/ButtonIcon';
import Button from '@/components/button/Button';
import Input from '@/components/input-text/InputText';
import Page from '@/components/page/Page';
import Panel from '@/components/panel/Panel';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Player {
   id: string;
   name: string;
}

const SetupClient = () => {
   const router = useRouter();
   const [players, setPlayers] = useState<Array<Player>>([{ id: crypto.randomUUID(), name: '' }]);

   const handleAddPlayer = () => {
      setPlayers((prevState) => {
         return [...prevState, { id: crypto.randomUUID(), name: '' }];
      });
   };

   const handleUpdatePlayer = (e: any, id: string) => {
      setPlayers((prevState) => {
         const tempState = [...prevState];
         const foundPlayer = tempState.find((player) => player.id === id);
         if (!foundPlayer) return tempState;
         foundPlayer.name = e.target.value;
         return tempState;
      });
   };

   const handleRemovePlayer = (id: string) => {
      setPlayers((prevState) => {
         return [...prevState].filter((player) => player.id !== id);
      });
   };

   const handleKeyPress = (e: any) => {
      if (e.key === 'Enter') handleAddPlayer();
   };

   const handleStartGame = () => {
      localStorage.setItem('players', JSON.stringify(players));
      router.push('/play-local');
   };

   return (
      <Page>
         <Panel className='flex flex-col items-center'>
            <span className='mb-4 text-3xl font-semibold text-yellow-500'>Greedy Pirate</span>
            <div className='flex flex-col gap-2'>
               <span className='text-sm text-secondary'>{`Enter Player Names`}</span>
               {players.map((player, index) => (
                  <div key={index} className={`min-w-[293px] grid grid-cols-[1fr_35px] gap-2`}>
                     <span className={`${players.length < 2 && 'col-span-2'}`}>
                        <Input
                           type='text'
                           placeholder='Name...'
                           autoFocus
                           value={player.name}
                           onChange={(e) => handleUpdatePlayer(e, player.id)}
                           onKeyDown={handleKeyPress}
                        />
                     </span>
                     {players.length >= 2 && (
                        <ButtonIcon iconName='XMark' onClick={() => handleRemovePlayer(player.id)} />
                     )}
                  </div>
               ))}
               <div className='flex justify-center'>
                  <Button color='teal' size='xs' onClick={handleAddPlayer}>
                     + Add Player
                  </Button>
               </div>
            </div>
            <div className='w-full grid mt-4'>
               <Button
                  color='purple'
                  disabled={players?.length < 2 || players.some((player) => !player.name)}
                  onClick={handleStartGame}>
                  Start Game!
               </Button>
            </div>
         </Panel>
      </Page>
   );
};

export default SetupClient;
