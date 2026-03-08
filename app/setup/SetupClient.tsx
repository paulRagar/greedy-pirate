'use client';
import ButtonIcon from '@/components/button-icon/ButtonIcon';
import Button from '@/components/button/Button';
import Input from '@/components/input-text/InputText';
import Page from '@/components/page/Page';
import Panel from '@/components/panel/Panel';
import { allDeckConfigs } from '@/lib/engine/deckBuilder';
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
   const [selectedDeckId, setSelectedDeckId] = useState<string>('standard');
   const [editingId, setEditingId] = useState<string | null>(null);

   useEffect(() => {
      const localStorageDataString: string = `${localStorage.getItem('players')}`;
      const playerData: Array<{ id: string; name: string }> = JSON.parse(localStorageDataString);
      if (playerData?.length) {
         setPlayers(playerData);
      }

      // Restore deck selection
      const storedDeck = localStorage.getItem('deckConfig');
      if (storedDeck) {
         setSelectedDeckId(storedDeck);
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

   const handleRenamePlayer = (id: string, newName: string) => {
      setPlayers((prevState) =>
         prevState.map((player) => (player.id === id ? { ...player, name: newName } : player))
      );
   };

   const handleMovePlayer = (index: number, direction: 'up' | 'down') => {
      setPlayers((prevState) => {
         const arr = [...prevState];
         const targetIndex = direction === 'up' ? index - 1 : index + 1;
         if (targetIndex < 0 || targetIndex >= arr.length) return arr;
         [arr[index], arr[targetIndex]] = [arr[targetIndex], arr[index]];
         return arr;
      });
   };

   const handleShufflePlayers = () => {
      setPlayers((prevState) => {
         const arr = [...prevState];
         for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
         }
         return arr;
      });
   };

   const handleKeyPress = (e: any) => {
      if (e.key === 'Enter' && players?.length < 10) handleAddPlayer();
   };

   const handleStartGame = () => {
      localStorage.setItem('players', JSON.stringify(players));
      localStorage.setItem('deckConfig', selectedDeckId);
      router.push('/play-local');
   };

   const selectedDeck = allDeckConfigs.find((d) => d.id === selectedDeckId);

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
               <div className='w-1/2 flex flex-col items-center'>
                  {players?.length > 1 && (
                     <button
                        onClick={handleShufflePlayers}
                        className='mb-2 px-3 py-1 rounded text-xs font-semibold bg-purple-700 text-purple-200 border border-purple-500 hover:bg-purple-600 transition-colors'
                        title='Randomize player order'>
                        Shuffle Order
                     </button>
                  )}
                  <div className='w-full max-h-[220px] overflow-y-auto flex flex-col gap-1'>
                     {players?.length ? (
                        players.map((player, index) => (
                           <div
                              key={player.id}
                              className='flex items-center gap-1 px-2 py-1 rounded bg-gray-200 dark:bg-slate-700'>
                              {/* Reorder arrows */}
                              <div className='flex flex-col'>
                                 <button
                                    onClick={() => handleMovePlayer(index, 'up')}
                                    disabled={index === 0}
                                    className='text-[10px] leading-[12px] text-gray-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed'
                                    title='Move up'>
                                    ▲
                                 </button>
                                 <button
                                    onClick={() => handleMovePlayer(index, 'down')}
                                    disabled={index === players.length - 1}
                                    className='text-[10px] leading-[12px] text-gray-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed'
                                    title='Move down'>
                                    ▼
                                 </button>
                              </div>
                              {/* Editable name */}
                              {editingId === player.id ? (
                                 <input
                                    type='text'
                                    value={player.name}
                                    onChange={(e) => handleRenamePlayer(player.id, e.target.value)}
                                    onBlur={() => setEditingId(null)}
                                    onKeyDown={(e) => {
                                       if (e.key === 'Enter') setEditingId(null);
                                    }}
                                    autoFocus
                                    className='flex-1 min-w-0 px-1 text-sm bg-slate-600 text-white rounded outline-none border border-teal-500'
                                 />
                              ) : (
                                 <span
                                    onClick={() => setEditingId(player.id)}
                                    className='flex-1 min-w-0 text-sm cursor-pointer hover:text-teal-400 truncate'
                                    title='Click to rename'>
                                    {player.name}
                                 </span>
                              )}
                              {/* Remove button */}
                              <ButtonIcon
                                 size='xs'
                                 color='transparent'
                                 iconName='XMark'
                                 onClick={() => handleRemovePlayer(player.id)}
                              />
                           </div>
                        ))
                     ) : (
                        <div className='flex justify-center p-2 rounded text-secondary bg-gray-200 dark:bg-slate-700'>
                           <span>{`Yer Ship Be Empty. Add Yer Crew.`}</span>
                        </div>
                     )}
                  </div>
               </div>
            </div>

            {/* Deck Picker (2D) */}
            <div className='w-full flex flex-col items-center gap-2'>
               <span className='text-sm text-secondary'>Choose Yer Deck</span>
               <div className='flex flex-wrap justify-center gap-2'>
                  {allDeckConfigs.map((config) => (
                     <button
                        key={config.id}
                        onClick={() => setSelectedDeckId(config.id)}
                        className={`px-3 py-1 rounded text-sm font-semibold border transition-colors ${
                           selectedDeckId === config.id
                              ? 'bg-purple-600 border-purple-400 text-white'
                              : 'bg-slate-700 border-slate-500 text-gray-300 hover:border-purple-400 hover:text-white'
                        }`}>
                        {config.name}
                     </button>
                  ))}
               </div>
               {selectedDeck && (
                  <span className='text-xs text-gray-400 text-center max-w-[400px]'>
                     {selectedDeck.description}
                  </span>
               )}
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
         </Panel>
      </Page>
   );
};

export default SetupClient;
