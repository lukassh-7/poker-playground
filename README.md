# 🃏 Poker Hand Category Generator

This project generates random **heads-up Texas Hold’em matchups** and classifies them into structured categories.  
It relies fully on the [pokersolver](https://www.npmjs.com/package/pokersolver) library for accurate hand evaluation.  

## 🚀 Usage

### Install

```bash
npm install
```

### Run generator

Generator can be run on empty ouput or existing (will add new exercies)

```bash
npm run start
```

### Clear output

```bash
npm run clear-output
```

## ✨ How It Works

The script runs through a simple but powerful pipeline:

1. **Random hands generation**  
   - A full 52-card deck is shuffled.  
   - Two players and a 5-card board are dealt (no duplicates).  

2. **Initial category assignment**  
   - Each player’s best hand is solved with `pokersolver`.  
   - Their hand names are combined into a base category:  
     - Example: `Pair` vs `High Card` → `pairVsHighCard`  
     - Example: `Straight` vs `Straight` → `straightVsStraight`  

3. **Category refinement**  
   - Equal-rank matchups are split into subcategories:  
     - `pairVsPair` → `pairVsLowerPair` | `pairVsPairKickerDecides` | `pairVsPairChop`  
     - `straightVsStraight` → `straightVsLowerStraight` | `straightVsStraightChop`  

4. **Board-aware chops**  
   - If a chop occurs **because the board itself is the best hand**, the category is further refined:  
     - `pairVsPairChop` → `onBoardPairChop`  
     - `straightVsStraightChop` → `onBoardStraightChop`  

---

## ⚡ Performance

- 2,000,000 iterations should complete in ~54 seconds
- Produces about 64 unique categories.
- Iteration count is configurable in package.json (see the scripts section).