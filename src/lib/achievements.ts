// Achievement catalog — pure data + predicates over a user's cumulative stats.
// Shared by the server (unlocks rows in `user_achievements` at game end) and the
// profile UI (renders unlocked vs locked). No IO; safe on client and server.

/** The cumulative stat fields an achievement can be evaluated against. */
export type AchievementStats = {
   readonly gamesPlayed: number;
   readonly gamesWon: number;
   readonly totalCoinsCollected: number;
   readonly totalPiratesEncountered: number;
   readonly longestStreakValue: number;
   readonly biggestSingleBank: number;
};

export type Achievement = {
   /** Stable identifier persisted in `user_achievements.code`. Never reuse. */
   readonly code: string;
   readonly title: string;
   /** Shown under the title; doubles as the hint while still locked. */
   readonly description: string;
   readonly icon: string;
   readonly isUnlocked: (stats: AchievementStats) => boolean;
};

export const ACHIEVEMENTS: readonly Achievement[] = [
   {
      code: 'first_win',
      title: 'First Plunder',
      description: 'Win your first voyage.',
      icon: '🏴‍☠️',
      isUnlocked: (s) => s.gamesWon >= 1,
   },
   {
      code: 'ten_voyages',
      title: 'Seasoned Sailor',
      description: 'Play 10 voyages.',
      icon: '⚓',
      isUnlocked: (s) => s.gamesPlayed >= 10,
   },
   {
      code: 'big_bank',
      title: 'Heavy Haul',
      description: 'Bank 20+ doubloons in a single turn.',
      icon: '💰',
      isUnlocked: (s) => s.biggestSingleBank >= 20,
   },
   {
      code: 'streak_ten',
      title: 'Nerves of Steel',
      description: 'Reach a 10-card streak without busting.',
      icon: '🔥',
      isUnlocked: (s) => s.longestStreakValue >= 10,
   },
] as const;

/** Codes the given stats currently satisfy. Used to upsert unlock rows. */
export function unlockedAchievementCodes(stats: AchievementStats): string[] {
   return ACHIEVEMENTS.filter((a) => a.isUnlocked(stats)).map((a) => a.code);
}
