'use client';

import Button from '@/components/button/Button';
import Icon from '@/components/icon/Icon';
import { useEffect, useState } from 'react';

type Player = {
   id: string;
   name: string;
   hasTurn: boolean;
   bankedCards: number[];
};

type Players = Array<Player>;

interface Props {
   showDeck?: boolean;
}

const PlayLocalClient = ({ showDeck }: Props) => {
   const [currentCard, setCurrentCard] = useState<number | null>();
   const [currentDeck, setCurrentDeck] = useState<number[]>();
   const [currentStreak, setCurrentStreak] = useState<number[]>([]);
   const [isGameOver, setIsGameOver] = useState<boolean>(false);
   const [players, setPlayers] = useState<Players>([]);
   const [winner, setWinner] = useState<Player>();

   const shuffle = (deck: number[]): number[] => {
      let currentIndex = deck.length,
         randomIndex;

      // While there remain elements to shuffle.
      while (currentIndex != 0) {
         // Pick a remaining element.
         randomIndex = Math.floor(Math.random() * currentIndex);
         currentIndex--;

         // And swap it with the current element.
         [deck[currentIndex], deck[randomIndex]] = [deck[randomIndex], deck[currentIndex]];
      }

      return deck;
   };

   useEffect(() => {
      const createNewDeck = (): number[] => {
         const newDeck = [
            2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
            1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
         ];
         // Squirrel = 2; Nut = 1;
         // newDeck.length = 52; 37 Nuts and 15 Squirrels
         return shuffle(newDeck);
      };

      if (!currentDeck) setCurrentDeck(createNewDeck());
   }, [currentDeck]);

   useEffect(() => {
      const localStorageDataString: string = `${localStorage.getItem('players')}`;
      const playerData: Array<{ id: string; name: string }> = JSON.parse(localStorageDataString);

      setPlayers(
         playerData.map((player, index) => ({
            ...player,
            hasTurn: index === 0,
            bankedCards: [],
         }))
      );
   }, []);

   const drawCard = () => {
      if (!currentDeck) return;
      setCurrentDeck((prevState) => {
         const tempState = prevState?.length ? [...prevState] : [];
         const topCard = tempState.shift();
         if (!topCard) return tempState;

         setCurrentCard(topCard);

         if (!tempState.length) setIsGameOver(true);
         setWinner([...players].sort((a, b) => b.bankedCards.length - a.bankedCards.length)[0]);

         setCurrentStreak((prevState) => [...prevState, topCard]);
         return tempState;
      });
      // if (!deckCopy.length) setIsGameOver(true);
      // setWinner([...players].sort((a, b) => b.bankedCards.length - a.bankedCards.length)[0]);
      // const newCurrentStreak = [...currentStreak, topCard];
      // setCurrentStreak(newCurrentStreak);
   };

   const bankCards = () => {
      setPlayers((prevState) => {
         const tempState = [...prevState];
         const currentPlayerIndex = tempState.findIndex((player) => player.hasTurn);
         currentStreak.forEach((card) => tempState[currentPlayerIndex].bankedCards.push(card));
         tempState[currentPlayerIndex].hasTurn = false;
         if (tempState[currentPlayerIndex + 1]) {
            tempState[currentPlayerIndex + 1].hasTurn = true;
         } else {
            tempState[0].hasTurn = true;
         }
         return tempState;
      });

      setCurrentStreak([]);
      setCurrentCard(null);
   };

   const finishTurn = () => {
      setPlayers((prevState) => {
         const tempState = [...prevState];
         const currentPlayerIndex = tempState.findIndex((player) => player.hasTurn);
         tempState[currentPlayerIndex].hasTurn = false;
         if (tempState[currentPlayerIndex + 1]) {
            tempState[currentPlayerIndex + 1].hasTurn = true;
         } else {
            tempState[0].hasTurn = true;
         }
         return tempState;
      });
      setCurrentStreak([]);
      setCurrentCard(null);
   };

   return (
      <div className='grid grid-cols-2 gap-4'>
         {players.map((player, index) => (
            <div key={index} className='flex flex-col gap-2 p-4 rounded shadow bg-white'>
               <div className='border-b'>
                  <span>{player.name}</span>
                  {player.hasTurn && <span className='bg-green-400 py-0.5 px-1 ml-1 rounded text-xs'>Your Turn</span>}
               </div>
               <div>
                  <span>Total: {player.bankedCards.length}</span>
                  <div className='flex gap-2'>
                     {!!player.bankedCards.length &&
                        player.bankedCards.map((card, index) => (
                           <div
                              key={index}
                              className={`
               card min-w-[15px] min-h-[23px] flex justify-center items-center rounded-sm
               ${card === 1 ? 'bg-green-200' : 'bg-red-200'}
              `}></div>
                        ))}
                  </div>
               </div>
            </div>
         ))}
         <div className='col-span-2 flex flex-col gap-2 items-center p-4 rounded shadow bg-white'>
            {isGameOver && (
               <div className='flex flex-col items-center py-1 px-2 rounded-sm shadow bg-blue-400 text-white'>
                  <span>Game Over!</span>
                  {winner && <span>{`${winner.name.toLocaleUpperCase()} Wins!`}</span>}
               </div>
            )}
            {!isGameOver && (
               <div className='flex gap-2'>
                  {currentCard === 2 ? (
                     <Button color='teal' onClick={finishTurn}>
                        Dang It!!
                     </Button>
                  ) : (
                     <>
                        <Button color='teal' onClick={drawCard} disabled={currentDeck && currentDeck.length < 1}>
                           Draw Card
                        </Button>
                        <Button color='purple' onClick={bankCards} disabled={!currentStreak.length}>
                           Bank Cards
                        </Button>
                     </>
                  )}
               </div>
            )}
            <div className='flex justify-center h-full w-full'>
               {/* Deck Card START */}
               <div className='min-w-[200px] min-h-[250px] p-4 flex justify-center items-center rounded border-[1px] border-slate-200 shadow-xl'>
                  <div className='w-full h-full border-4 border-green-700 p-2'>
                     <div className='w-full h-full bg-green-700 p-2'></div>
                  </div>
               </div>
               {/* Deck Card END */}
               {currentCard ? (
                  <div
                     className={`
               card min-w-[200px] min-h-[250px] flex justify-center items-center rounded border-2 border-black
               ${currentCard === 1 ? 'bg-green-200' : 'bg-red-200'}
              `}>
                     {currentCard === 1 ? (
                        <Icon name='Acorn' className='fill-yellow-600' width={200} />
                     ) : (
                        <Icon name='Squirrel' className='fill-orange-900' width={200} />
                     )}
                  </div>
               ) : (
                  <div
                     className={`
         card min-w-[200px] min-h-[250px] flex justify-center items-center rounded
        `}>
                     Greedy Pirate
                  </div>
               )}
            </div>
            <div className='flex gap-2'>
               {currentCard && currentCard === 1 && !!currentStreak.length && (
                  <>
                     <span>Current Streak:</span>
                     {currentStreak.map((card, index) => (
                        <div
                           key={index}
                           className={`
               card min-w-[15px] min-h-[23px] flex justify-center items-center rounded-sm
               ${currentCard === 1 ? 'bg-green-200' : 'bg-red-200'}
              `}></div>
                     ))}
                  </>
               )}
            </div>
         </div>
         {showDeck && (
            <div className='col-span-2 flex gap-2 p-4 rounded shadow bg-white'>
               {currentDeck &&
                  currentDeck.map((card: number, index) => (
                     <div
                        key={index}
                        className={`
                  card min-w-[15px] min-h-[23px] flex justify-center items-center rounded-sm
                  ${card === 1 ? 'bg-green-200' : 'bg-red-200'}
                  `}></div>
                  ))}
            </div>
         )}
      </div>
   );
};

export default PlayLocalClient;
