# Boss1 Size Fix Documentation

## Problem

Boss1 (三當家, elite_shield) appeared normal size when spawning or moving, but suddenly became very large after using skills (霸山墜 leap slam, 震撼咆哮 warcry, 連續重擊 combo strike).

## Root Cause

In `src/scenes/GameScene.ts`, the `spawnLeapSlam` method used hardcoded `setScale(1)` to restore Boss visual scale after the leap skill animation:

```typescript
// ❌ Wrong: Hardcoded scale value
eliteVisual.setScale(1);

// Also wrong in tween:
scaleX: 1.3, scaleY: 1.3  // Should be relative to base scale
onComplete: () => { eliteVisual.setScale(1); }
```

**Why this caused the bug:**

1. Boss1 uses Sprite animation with `setDisplaySize(200, 200)` (defined in `ENEMY_VISUAL_SIZE['boss1']`)
2. `setDisplaySize()` internally sets the sprite's `scaleX` and `scaleY` to match the target display size
3. These calculated scale values are stored in `visualBaseScaleX` and `visualBaseScaleY` in `Enemy.ts`
4. For Boss1's 200×200 display size, the base scale is **not 1** — it depends on the source texture dimensions
5. When skills called `setScale(1)`, it ignored the correct base scale and made the Boss appear at the wrong size

## Solution

Modified `src/scenes/GameScene.ts` line 2165-2194 to use the Boss's stored base scale values instead of hardcoded `1`:

```typescript
// ✅ Correct: Use stored base scale values
const bsx = (elite as any).visualBaseScaleX ?? 1;
const bsy = (elite as any).visualBaseScaleY ?? 1;
eliteVisual.setScale(bsx, bsy);

// Also correct in tween:
scaleX: bsx * 1.3, scaleY: bsy * 1.3  // Scale relative to base
onComplete: () => { eliteVisual.setScale(bsx, bsy); }
```

This ensures the Boss visual is restored to the correct size that matches the `setDisplaySize(200, 200)` configuration.

## Modified Files

- `src/scenes/GameScene.ts` (lines 2165-2194)
  - Fixed 3 `setScale()` calls in `spawnLeapSlam()` method
  - Fixed scale tween values to be relative to base scale

## Build Result

```
✓ 46 modules transformed
dist/assets/index-Cbj8N5Dg.js  236.01 kB │ gzip: 61.68 kB
✓ built in 7.23s
```

Build size: **236.01 kB** (increased by ~1 kB from 235.83 kB, acceptable change)

## Testing Checklist

- [ ] Boss1 spawns at correct size (200×200)
- [ ] Boss1 remains correct size when moving
- [ ] Boss1 remains correct size after using 霸山墜 (leap slam)
- [ ] Boss1 remains correct size after using 震撼咆哮 (warcry) 
- [ ] Boss1 remains correct size after using 連續重擊 (combo strike)
- [ ] Boss1 scale animation during leap (shrink 0.7→1.3→base) looks smooth
- [ ] Boss1 size is consistent throughout entire battle

## Additional Notes

- **Minimal change approach**: Only modified the specific bug location, did not refactor other code
- **No impact on other skills**: 震撼咆哮 and 連續重擊 don't modify Boss scale, so they were not affected
- **Graphics fallback preserved**: The fix uses `?? 1` fallback for Graphics-based enemies that don't have base scale values
- **Consistent with project conventions**: Follows the pattern already used in `Enemy.ts` line 327 for hit flash restoration

## Related Code References

- `src/objects/Enemy.ts` line 553: Boss1 sprite created with `setDisplaySize(200, 200)`
- `src/objects/Enemy.ts` lines 242-243, 252-253, 557-558: `visualBaseScaleX/Y` values stored
- `src/objects/Enemy.ts` line 327: Same pattern used for hit flash recovery
- `src/objects/Enemy.ts` lines 9-19: `ENEMY_VISUAL_SIZE` configuration
