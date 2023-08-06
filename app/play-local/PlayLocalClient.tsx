'use client';

import Button from '@/components/button/Button';
import Icon from '@/components/icon/Icon';
import Panel from '@/components/panel/Panel';
import { useEffect, useState } from 'react';

type Player = {
   id: string;
   name: string;
   hasTurn: boolean;
   bankedCards: number[];
};

type Players = Array<Player>;

interface Props {
   evenGreedier?: boolean;
   showDeck?: boolean;
}

const PlayLocalClient = ({ evenGreedier, showDeck }: Props) => {
   const [currentCard, setCurrentCard] = useState<number | null>();
   const [currentDeck, setCurrentDeck] = useState<number[]>();
   const [currentStreak, setCurrentStreak] = useState<number[]>([]);
   const [isGameOver, setIsGameOver] = useState<boolean>(false);
   const [players, setPlayers] = useState<Players>([]);
   const [playerWithTurn, setPlayerWithTurn] = useState<Player>();
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
         playerData.map((player, index) => {
            const newPlayer = {
               ...player,
               hasTurn: index === 0,
               bankedCards: [],
            };
            if (index === 0) setPlayerWithTurn(newPlayer);
            return newPlayer;
         })
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
            setPlayerWithTurn(tempState[currentPlayerIndex + 1]);
         } else {
            tempState[0].hasTurn = true;
         }
         return tempState;
      });
      setCurrentStreak([]);
      setCurrentCard(null);
   };

   return (
      <div className='grid grid-cols-4 gap-4'>
         <Panel className='col-span-4 flex flex-col items-center gap-2'>
            {isGameOver && (
               <div className='flex flex-col items-center py-1 px-2 rounded-sm shadow bg-blue-400 text-white'>
                  <span>Game Over!</span>
                  {winner && <span>{`${winner.name.toLocaleUpperCase()} Wins!`}</span>}
               </div>
            )}
            {!isGameOver && (
               <div className='min-h-[30px] flex items-center gap-2'>
                  {currentCard === 2 ? (
                     <>
                        <span className='text-lg'>Argh! That pirate has plundered your gold!</span>
                        <Button color='teal' size='sm' onClick={finishTurn}>
                           End Turn
                        </Button>
                     </>
                  ) : (
                     <span className='text-lg'>{playerWithTurn?.name}! Take the helm for it is your turn!</span>
                  )}
               </div>
            )}
            <div className='flex justify-center items-center h-full w-full gap-4'>
               <Button
                  color='teal'
                  onClick={drawCard}
                  disabled={(currentDeck && currentDeck.length < 1) || currentCard === 2}>
                  Draw Card
               </Button>
               {/* Deck Start */}
               <div className='w-[200px] h-[250px] max-w-[200px] max-h-[250px] p-4 flex justify-center items-center rounded shadow-lg border-[1px] border-slate-500 dark:border-slate-500 bg-slate-800 '>
                  <div className='w-full h-full border-4 border-teal-500 p-2'>
                     <div className='w-full h-full p-2 flex flex-col items-center justify-center bg-purple-500'>
                        <span className='text-3xl font-semibold text-yellow-500'>Greedy</span>
                        <span className='text-3xl font-semibold text-yellow-500'>Pirate</span>
                     </div>
                  </div>
               </div>
               {/* Deck End */}
               {/* Card Start */}
               {currentCard ? (
                  <div
                     className={`w-[200px] h-[250px] max-w-[200px] max-h-[250px] flex justify-center items-center rounded border-2 border-black
                        ${currentCard === 1 ? 'bg-slate-800' : 'bg-red-900'}
                     `}>
                     {currentCard === 1 ? (
                        <Icon name='Coin1' className='fill-yellow-500' height={200} />
                     ) : (
                        <Icon name='Pirate' className='fill-purple-500' height={200} />
                     )}
                  </div>
               ) : (
                  <div
                     className={`w-[200px] h-[250px] flex justify-center items-center rounded border-[1px] border-slate-300 dark:border-slate-500 bg-slate-50 dark:bg-slate-700`}></div>
               )}
               {/* Card End */}
               <Button color='purple' onClick={bankCards} disabled={!currentStreak.length || currentCard === 2}>
                  Bank Cards
               </Button>
            </div>
            <div className='flex gap-2 pt-2 items-center'>
               <span>Current Streak:</span>
               {currentStreak.map((card, index) => (
                  <Icon key={index} name='Coin1' color='yellow' width={15} />
               ))}
            </div>
         </Panel>
         <div className='col-span-4 flex justify-center items-center gap-4'>
            {players.map((player, index) => (
               <Panel
                  key={index}
                  className={`w-1/4 flex flex-col items-center ${player.hasTurn && 'border-4 border-teal-500'}`}>
                  <div className={`w-full flex justify-center border-b-2 ${player.hasTurn && 'border-teal-500'}`}>
                     <span className='text-2xl font-semibold pb-2'>{player.name}</span>
                  </div>
                  <div className='pt-2'>
                     <span className='text-5xl font-bold text-yellow-500'>{player.bankedCards.length}</span>
                  </div>
               </Panel>
            ))}
         </div>
         {showDeck && (
            <Panel className='col-span-4 flex flex-wrap gap-1'>
               {currentDeck &&
                  currentDeck.map((card: number, index) => (
                     <div
                        key={index}
                        className={`
                  card min-w-[15px] min-h-[23px] flex justify-center items-center rounded-sm
                  ${card === 1 ? 'bg-green-200' : 'bg-red-200'}
                  `}></div>
                  ))}
            </Panel>
         )}
      </div>
   );
};

export default PlayLocalClient;
