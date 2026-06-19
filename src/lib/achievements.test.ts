import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, unlockedAchievementCodes, type AchievementStats } from './achievements';

const ZERO: AchievementStats = {
   gamesPlayed: 0,
   gamesWon: 0,
   totalCoinsCollected: 0,
   totalPiratesEncountered: 0,
   longestStreakValue: 0,
   biggestSingleBank: 0,
};

describe('achievements catalog', () => {
   it('has unique, stable codes', () => {
      const codes = ACHIEVEMENTS.map((a) => a.code);
      expect(new Set(codes).size).toBe(codes.length);
   });

   it('unlocks nothing for a fresh account', () => {
      expect(unlockedAchievementCodes(ZERO)).toEqual([]);
   });

   it('unlocks first_win at one win', () => {
      expect(unlockedAchievementCodes({ ...ZERO, gamesWon: 1 })).toContain('first_win');
   });

   it('unlocks ten_voyages only at 10 games', () => {
      expect(unlockedAchievementCodes({ ...ZERO, gamesPlayed: 9 })).not.toContain('ten_voyages');
      expect(unlockedAchievementCodes({ ...ZERO, gamesPlayed: 10 })).toContain('ten_voyages');
   });

   it('unlocks big_bank at a 20+ single bank', () => {
      expect(unlockedAchievementCodes({ ...ZERO, biggestSingleBank: 19 })).not.toContain('big_bank');
      expect(unlockedAchievementCodes({ ...ZERO, biggestSingleBank: 20 })).toContain('big_bank');
   });

   it('unlocks streak_ten at a 10-card streak', () => {
      expect(unlockedAchievementCodes({ ...ZERO, longestStreakValue: 9 })).not.toContain('streak_ten');
      expect(unlockedAchievementCodes({ ...ZERO, longestStreakValue: 10 })).toContain('streak_ten');
   });

   it('unlocks everything when all thresholds are crossed', () => {
      const maxed: AchievementStats = {
         gamesPlayed: 50,
         gamesWon: 25,
         totalCoinsCollected: 9999,
         totalPiratesEncountered: 80,
         longestStreakValue: 12,
         biggestSingleBank: 30,
      };
      expect(unlockedAchievementCodes(maxed).sort()).toEqual(ACHIEVEMENTS.map((a) => a.code).sort());
   });
});
