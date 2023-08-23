'use client';

import Button from '@/components/button/Button';
import Icon from '@/components/icon/Icon';
import Modal from '@/components/modal/Modal';
import Page from '@/components/page/Page';
import Panel from '@/components/panel/Panel';
import { Deck, evenGreedierDeck, greedyDeck, superGreedyDeck } from '@/types/deck';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Player = {
   id: string;
   name: string;
   hasTurn: boolean;
   coins: number;
};

type Players = Array<Player>;

interface Props {
   evenGreedier?: boolean;
   showDeck?: boolean;
}

const PlayLocalClient = ({ evenGreedier, showDeck }: Props) => {
   const router = useRouter();

   const [newGame, setNewGame] = useState<boolean>(true);
   const [currentCard, setCurrentCard] = useState<number | 'pirate' | null>();
   const [currentDeck, setCurrentDeck] = useState<Deck>();
   const [currentStreak, setCurrentStreak] = useState<Deck>([]);
   const [isGameOver, setIsGameOver] = useState<boolean>(false);
   const [players, setPlayers] = useState<Players>([]);
   const [playerWithTurn, setPlayerWithTurn] = useState<Player>();
   const [winner, setWinner] = useState<Player>();
   const [showEndGameModal, setShowEndGameModal] = useState<boolean>(false);

   const shuffle = (deck: Deck): Deck => {
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
      const createNewDeck = (): Deck => {
         let newDeck: Array<number | 'pirate'>;
         if (evenGreedier) {
            // newDeck = [...evenGreedierDeck];
            newDeck = [...superGreedyDeck];
         } else {
            newDeck = [...greedyDeck];
         }

         return shuffle(newDeck);
      };

      if (!currentDeck) setCurrentDeck(createNewDeck());
   }, [currentDeck, evenGreedier]);

   useEffect(() => {
      if (newGame) {
         setNewGame(false);
         const localStorageDataString: string = `${localStorage.getItem('players')}`;
         const playerData: Array<{ id: string; name: string }> = JSON.parse(localStorageDataString);

         if (playerData?.length) {
            setPlayers(
               playerData.map((player, index) => {
                  const newPlayer = {
                     ...player,
                     hasTurn: index === 0,
                     coins: 0,
                  };
                  if (index === 0) setPlayerWithTurn(newPlayer);
                  return newPlayer;
               })
            );
         } else {
            router.push('/setup');
         }
      }
   }, [newGame, router]);

   const drawCard = () => {
      if (!currentDeck) return;
      setCurrentDeck((prevState) => {
         const tempState = prevState?.length ? [...prevState] : [];
         const topCard = tempState.shift();
         if (!topCard) return tempState;

         setCurrentCard(topCard);
         if (!tempState.length) {
            finishGame(topCard);
            return tempState;
         }

         setCurrentStreak((prevState) => [...prevState, topCard]);
         return tempState;
      });
   };

   const finishGame = (topCard: number | 'pirate') => {
      setIsGameOver(true);
      if (topCard !== 'pirate') {
         setPlayers((prevState) => {
            const tempState = [...prevState];
            const playerWithTurn = tempState.find((player) => player.hasTurn);
            if (!playerWithTurn) return tempState;

            const currentStreakSum = currentStreak.reduce((acc: number, curr: number | 'pirate') => {
               if (curr !== 'pirate') {
                  acc += curr;
               }
               return acc;
            }, 0);

            playerWithTurn.coins += currentStreakSum + topCard;
            setWinner([...tempState].sort((a, b) => b.coins - a.coins)[0]);

            return tempState;
         });
      } else {
         setWinner([...players].sort((a, b) => b.coins - a.coins)[0]);
      }
      setCurrentStreak([]);
      setShowEndGameModal(true);
   };

   const bankCards = () => {
      setPlayers((prevState) => {
         const tempState = [...prevState];
         const currentPlayerIndex = tempState.findIndex((player) => player.hasTurn);
         currentStreak.forEach((card) => {
            if (card !== 'pirate') {
               tempState[currentPlayerIndex].coins += card;
            }
         });
         tempState[currentPlayerIndex].hasTurn = false;
         if (tempState[currentPlayerIndex + 1]) {
            tempState[currentPlayerIndex + 1].hasTurn = true;
            setPlayerWithTurn(tempState[currentPlayerIndex + 1]);
         } else {
            tempState[0].hasTurn = true;
            setPlayerWithTurn(tempState[0]);
         }
         return tempState;
      });

      clearStreakAndCard();
   };

   const clearStreakAndCard = () => {
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
            setPlayerWithTurn(tempState[0]);
         }
         return tempState;
      });
      clearStreakAndCard();
   };

   return (
      <Page>
         <Panel className='flex flex-col items-center gap-4'>
            {isGameOver && (
               <div className='min-h-[30px] flex items-center gap-2'>
                  <span className='text-lg'>{`The treasure be all ours now! Set course for home!`}</span>
               </div>
            )}
            {!isGameOver && (
               <div className='min-h-[30px] flex items-center gap-2'>
                  {currentCard === 'pirate' ? (
                     <>
                        <span className='text-lg'>
                           Shiver me timbers! Yer greed for gold has lured a pirate to plunder!
                        </span>
                     </>
                  ) : (
                     <span className='text-lg'>{playerWithTurn?.name}! Take the helm for it be yer turn!</span>
                  )}
               </div>
            )}
            <div className='grid grid-cols-3 gap-4'>
               {currentCard ? (
                  <div
                     className={`w-[190px] h-[250px] max-w-[190px] max-h-[250px] flex justify-center items-center rounded border-2 border-black
                        ${currentCard === 'pirate' ? 'bg-red-900' : 'bg-slate-800'}
                     `}>
                     {currentCard === 'pirate' ? (
                        <Icon name='Pirate' className='fill-purple-500' height={200} />
                     ) : currentCard > 5 ? (
                        <span className='text-2xl text-yellow-500'>{currentCard}</span>
                     ) : (
                        // @ts-ignore
                        <Icon name={`Coin${currentCard}`} className='fill-yellow-500' height={200} />
                     )}
                  </div>
               ) : (
                  <div className='w-[190px] h-[250px] max-w-[190px] max-h-[250px] p-4 flex justify-center items-center rounded shadow-lg border-[1px] border-slate-500 dark:border-slate-500 bg-slate-800 '>
                     <div className='w-full h-full border-4 border-teal-500 p-2'>
                        <div className='w-full h-full p-2 flex flex-col items-center justify-center bg-purple-500'>
                           <span className='text-3xl font-semibold text-yellow-500'>Greedy</span>
                           <span className='text-3xl font-semibold text-yellow-500'>Pirate</span>
                        </div>
                     </div>
                  </div>
               )}
               <div className='flex flex-col gap-2'>
                  <Button
                     color='teal'
                     onClick={drawCard}
                     disabled={(currentDeck && currentDeck.length < 1) || currentCard === 'pirate'}>
                     Plunder
                  </Button>
                  <Button
                     color='purple'
                     onClick={bankCards}
                     disabled={!currentStreak.length || currentCard === 'pirate'}>
                     Bury It
                  </Button>
                  {!isGameOver && currentCard === 'pirate' && (
                     <Button color='teal' size='sm' onClick={finishTurn}>
                        End Turn
                     </Button>
                  )}
                  <div className='flex justify-center gap-2 pt-2 items-center'>
                     <span>Booty:</span>
                     <span className='text-lg font-semibold text-yellow-500'>
                        {currentStreak.reduce((acc: number, curr: number | 'pirate') => {
                           if (curr !== 'pirate') {
                              acc += curr;
                           }
                           return acc;
                        }, 0)}
                     </span>
                  </div>
                  <div className='flex flex-wrap justify-center'>
                     {currentStreak.map((card, index) => {
                        if (card !== 'pirate')
                           return (
                              <span className='mx-1'>
                                 {/* @ts-ignore */}
                                 <Icon key={index} name={`Coin${card}`} color='yellow' width={15} />
                              </span>
                           );
                     })}
                  </div>
               </div>
               <div className='grid items-center'>
                  <div className='flex flex-col p-2 bg-gray-200 dark:bg-slate-700'>
                     {players.map((player, index) => (
                        <div
                           key={index}
                           className={`max-h-[18px] flex justify-between items-center p-2 rounded ${
                              players.length > 9 ? 'my-[3px]' : 'my-1'
                           }`}>
                           <span className={`text-lg ${player.hasTurn && 'text-teal-500 font-semibold'}`}>
                              {player.name}
                           </span>
                           <span className='text-lg font-bold text-yellow-500'>{player.coins}</span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
         </Panel>
         <Modal
            showModal={showEndGameModal}
            onClose={() => setShowEndGameModal(!showEndGameModal)}
            closeOnBackdropClick={false}>
            <div className='w-full flex flex-col items-center px-4 py-2'>
               <span className='text-2xl font-semibold text-yellow-500'>{winner?.name} Wins!</span>
               <span className='text-xl font-semibold text-yellow-500'>
                  Coins: <span className='pl-1'>{winner?.coins}</span>
               </span>
               <div className='w-full max-h-[250px] px-14 flex flex-col flex-wrap'>
                  {players
                     .filter((player) => player.id !== winner?.id)
                     .sort((a, b) => b.coins - a.coins)
                     .map((player, index) => (
                        <div key={player.id} className='flex justify-between'>
                           <span className='font-bold'>
                              <span className='text-gray-400 dark:text-slate-400'>{index + 2}.</span>
                              <span className='pl-2 font-semibold'>{player.name}</span>
                           </span>
                           <span className='font-semibold text-yellow-500'>{player.coins}</span>
                        </div>
                     ))}
               </div>

               <div className='mt-2 flex gap-4'>
                  <Button color='teal' onClick={() => router.push('/setup')}>
                     Change Players
                  </Button>
                  <Button
                     color='purple'
                     onClick={() => {
                        // @ts-ignore
                        setCurrentDeck(null);
                        setNewGame(true);
                        setIsGameOver(false);
                        clearStreakAndCard();
                        setShowEndGameModal(false);
                     }}>
                     Play Again!
                  </Button>
               </div>
            </div>
         </Modal>
      </Page>
   );
};

export default PlayLocalClient;
