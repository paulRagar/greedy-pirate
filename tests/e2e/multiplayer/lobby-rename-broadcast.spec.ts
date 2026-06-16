import { test, expect } from '../../fixtures/users';
import { HomePage } from '../../pages/HomePage';
import { LobbyPage } from '../../pages/LobbyPage';
import { JoinGatePage } from '../../pages/JoinGatePage';

/**
 * Ideal flow under test:
 *   1. Captain A charters a public room.
 *   2. Crewmate B opens the room URL fresh — the anonymous bootstrap
 *      signs them in, the JoinGate offers "Board the ship", they
 *      board, the lobby renders.
 *   3. The post-admission nudge auto-opens B's rename modal a few
 *      seconds after seating.
 *   4. B picks "Buckus" and saves.
 *   5. Both A and B see "Buckus" in the crew list without any reload.
 *
 * Failure here points at one of: the public-room JoinGate flow, the
 * post-admission nudge, setDisplayName's propagation to game_players,
 * or the realtime broadcast that wakes up A's lobby.
 */
test('rename in lobby broadcasts to every connected player', async ({ contextA, contextB }) => {
   const pageA = await contextA.newPage();
   const pageB = await contextB.newPage();

   const home = new HomePage(pageA);
   const lobbyA = new LobbyPage(pageA);
   const lobbyB = new LobbyPage(pageB);
   const gateB = new JoinGatePage(pageB);

   const code = await home.createRoom('public');

   await pageB.goto(`/play/${code}`);
   await gateB.board();

   // B's lobby renders.
   await pageB.getByTestId('room-code').waitFor({ state: 'visible' });

   // A should now see two crewmates aboard.
   await expect(pageA.getByTestId('crew-row')).toHaveCount(2, { timeout: 5_000 });

   // Drive the rename through the pencil — the same `setDisplayName`
   // action the post-admission nudge would fire, but with no timing
   // race for the test to depend on.
   await lobbyB.setName('Buckus');

   // Broadcast should propagate within a second; allow some slack.
   await lobbyA.expectPlayerNamed('Buckus');
   await lobbyB.expectPlayerNamed('Buckus');
});
