"use client";

import { useEffect, useState } from "react";

type Player = {
  name: string;
  hasTurn: boolean;
  bankedCards: number[];
};

type Players = Player[];

type Props = {
  numberOfPlayers?: number;
};

const HomeClient = ({ numberOfPlayers = 2 }: Props) => {
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
      [deck[currentIndex], deck[randomIndex]] = [
        deck[randomIndex],
        deck[currentIndex],
      ];
    }

    return deck;
  };

  useEffect(() => {
    const createNewDeck = (): number[] => {
      //  const newDeck = [1, 1, 2, 2, 2]; // 0 = Squirrel, 1 = Nut
      const newDeck = [
        2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1,
      ]; // 0 = Squirrel, 1 = Nut
      return shuffle(newDeck);
    };

    if (!currentDeck) setCurrentDeck(createNewDeck());
  }, [currentDeck]);

  useEffect(() => {
    if (!players.length) {
      const playersArray = [];
      for (let i = 0; i < numberOfPlayers; i++) {
        playersArray.push({
          name: i + 1 === numberOfPlayers ? "Harbor" : `Player ${i + 1}`,
          hasTurn: i === 0,
          bankedCards: [],
        });
      }
      setPlayers(playersArray);
    }
  }, [players.length, numberOfPlayers]);

  const drawCard = () => {
    if (!currentDeck) return;
    const deckCopy = [...currentDeck];
    const topCard = deckCopy.shift();
    if (!topCard) return;
    setCurrentCard(topCard);
    setCurrentDeck(deckCopy);
    if (!deckCopy.length) setIsGameOver(true);
    setWinner(
      [...players].sort(
        (a, b) => b.bankedCards.length - a.bankedCards.length
      )[0]
    );
    const newCurrentStreak = [...currentStreak, topCard];
    setCurrentStreak(newCurrentStreak);
  };

  const bankCards = () => {
    const playersCopy = [...players];
    const currentPlayerIndex = playersCopy.findIndex(
      (player) => player.hasTurn
    );
    currentStreak.forEach((card) =>
      playersCopy[currentPlayerIndex].bankedCards.push(card)
    );
    playersCopy[currentPlayerIndex].hasTurn = false;
    if (playersCopy[currentPlayerIndex + 1]) {
      playersCopy[currentPlayerIndex + 1].hasTurn = true;
    } else {
      playersCopy[0].hasTurn = true;
    }
    setPlayers(playersCopy);
    setCurrentStreak([]);
    setCurrentCard(null);
  };
  const finishTurn = () => {
    const playersCopy = [...players];
    const currentPlayerIndex = playersCopy.findIndex(
      (player) => player.hasTurn
    );
    playersCopy[currentPlayerIndex].hasTurn = false;
    if (playersCopy[currentPlayerIndex + 1]) {
      playersCopy[currentPlayerIndex + 1].hasTurn = true;
    } else {
      playersCopy[0].hasTurn = true;
    }
    setPlayers(playersCopy);
    setCurrentStreak([]);
    setCurrentCard(null);
  };
  return (
    <div className="grid grid-cols-2 gap-4">
      {players.map((player, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 p-4 rounded shadow bg-white"
        >
          <div className="border-b">
            <span>{player.name}</span>
            {player.hasTurn && (
              <span className="bg-green-400 py-0.5 px-1 ml-1 rounded text-xs">
                Your Turn
              </span>
            )}
          </div>
          <div>
            <span>Total: {player.bankedCards.length}</span>
            <div className="flex gap-2">
              {!!player.bankedCards.length &&
                player.bankedCards.map((card, index) => (
                  <div
                    key={index}
                    className={`
               card min-w-[15px] min-h-[23px] flex justify-center items-center rounded-sm
               ${card === 1 ? "bg-green-200" : "bg-red-200"}
              `}
                  ></div>
                ))}
            </div>
          </div>
        </div>
      ))}
      <div className="col-span-2 flex flex-col gap-2 items-center p-4 rounded shadow bg-white">
        {isGameOver && (
          <div className="flex flex-col items-center py-1 px-2 rounded-sm shadow bg-blue-400 text-white">
            <span>Game Over!</span>
            {winner && (
              <span>{`${winner.name.toLocaleUpperCase()} Wins!`}</span>
            )}
          </div>
        )}
        {!isGameOver && (
          <div className="flex gap-2">
            {currentCard === 2 ? (
              <button
                className="bg-slate-400 text-white rounded-sm py-2 px-4"
                onClick={finishTurn}
              >
                Dang It!!
              </button>
            ) : (
              <>
                <button
                  className="bg-blue-500 disabled:bg-blue-300 text-white rounded-sm py-2 px-4"
                  onClick={drawCard}
                  disabled={currentDeck && currentDeck.length < 1}
                >
                  Draw Card
                </button>
                <button
                  className="bg-green-500 disabled:bg-green-300 disabled:cursor-not-allowed text-white rounded-sm py-2 px-4"
                  onClick={bankCards}
                  disabled={!currentStreak.length}
                >
                  Bank Cards
                </button>
              </>
            )}
          </div>
        )}
        <div className="flex justify-center h-full w-full">
          {currentCard && (
            <div
              className={`
               card min-w-[100px] min-h-[150px] flex justify-center items-center rounded
               ${currentCard === 1 ? "bg-green-200" : "bg-red-200"}
              `}
            >
              <span>{currentCard === 1 ? "Nut" : "Squirrel"}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {currentCard && currentCard === 1 && !!currentStreak.length && (
            <>
              <span>Current Streak:</span>
              {currentStreak.map((card, index) => (
                <div
                  key={index}
                  className={`
               card min-w-[15px] min-h-[23px] flex justify-center items-center rounded-sm
               ${currentCard === 1 ? "bg-green-200" : "bg-red-200"}
              `}
                ></div>
              ))}
            </>
          )}
        </div>
      </div>
      {/* <div className="col-span-2 flex gap-2 p-4 rounded shadow bg-white">
        {currentDeck &&
          currentDeck.map((card: number, index) => (
            <div
              key={index}
              className={`
               card min-w-[15px] min-h-[23px] flex justify-center items-center rounded-sm
               ${card === 1 ? "bg-green-200" : "bg-red-200"}
            `}
            ></div>
          ))}
      </div> */}
    </div>
  );
};

export default HomeClient;
