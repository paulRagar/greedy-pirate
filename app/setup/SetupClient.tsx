'use client';
import Icon from '@/components/icon/Icon';
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
      <div className='absolute left-[50%] top-[50%] transform translate-x-[-50%] translate-y-[-50%]'>
         <div className='min-w-[325px] flex flex-col items-center p-4 rounded shadow-lg bg-white'>
            <h1 className='font-semibold mb-4'>Nut Nut Squirrel</h1>
            <div className='flex flex-col gap-2'>
               <span className='text-sm text-gray-500'>{`Enter Player Names`}</span>
               {players.map((player, index) => (
                  <div key={index} className={`min-w-[293px] grid grid-cols-[1fr_35px] gap-2`}>
                     <input
                        type='text'
                        placeholder='Name...'
                        autoFocus
                        value={player.name}
                        onChange={(e) => handleUpdatePlayer(e, player.id)}
                        onKeyDown={handleKeyPress}
                        className={`min-w-[250px] py-1 px-2 rounded border-[1px] border-gray-200 bg-gray-100 ${
                           players.length < 2 && 'col-span-2'
                        }`}
                     />
                     {players.length >= 2 && (
                        <button
                           onClick={() => handleRemovePlayer(player.id)}
                           className='flex justify-center items-center min-w-[35px] rounded border-[1px] border-gray-200 bg-gray-100 cursor-pointer'>
                           <Icon name={'XmarkSolid'} color='light' width='18' />
                        </button>
                     )}
                  </div>
               ))}
               <div className='flex justify-center'>
                  <button onClick={handleAddPlayer} className='py-2 px-4 rounded bg-blue-500 text-white cursor-pointer'>
                     + Add Player
                  </button>
               </div>
            </div>
            <button
               disabled={players?.length < 2 || players.some((player) => !player.name)}
               className='w-full mt-6 py-2 px-4 rounded bg-green-500 disabled:bg-green-300  text-white cursor-pointer disabled:cursor-not-allowed'
               onClick={handleStartGame}>
               Start Game!
            </button>
         </div>
      </div>
   );
};

export default SetupClient;
