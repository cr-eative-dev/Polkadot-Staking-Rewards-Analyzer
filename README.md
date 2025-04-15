# Polkadot Validator Rewards Analyzer

dAPP for analyzing, comparing, and tracking validator performance and rewards on the Polkadot Relay Chain.

## Overview

this dAPP allows nominators to make data-driven decisions when selecting validators for staking. Built using React, TypeScript, and the latest Polkadot API (`polkadot-api`) aka PAPI, you will find a nice interface for comparing validators based on performance metrics such as rewards, APY, and commission rates across multiple eras.

## Features

### Main
- ✅ display current validator set with performance metrics
- ✅ view and compare historical performance across past eras
- ✅ real-time APY calculation based on actual on-chain data
- ✅ sort validators by performance (APY)

### Quality of Life
- ✅ **filter by commission rates** - toggle to include/exclude 100% commission validators
- ✅ **filter validators by nomination status** - show or hide validators that don't accept nominations
- ✅ **historical performance analysis** - view detailed era-by-era breakdown of validator performance
- ✅ **performance metrics** - track points, rewards, commission changes, and calculated APY
- ✅ **adjustable history length** - choose how many past eras to analyze (up to 84)

## TechStack
- **React 19** - UI components
- **TypeScript** - type safety and improved developer experience
- **Zustand** - state management
- **Polkadot API** - uing the new JSON-RPC spec via `polkadot-api` aka PAPI package
- **TailwindCSS** - styling

### Architecture

the dAPP has a modular architecture:

- **stores** - central state management with Zustand
- **components** - reusable UI elements
- **hooks** - custom React hooks for business logic abstraction
- **utils** - utility functions for API calls and data formatting

1. `validatorStore.ts` - central state store containing all validator data and logic
2. `useValidatorData.ts` - hook that exposes store data and operations to React components
3. `ValidatorTable.tsx` - main table component for displaying validator data
4. `HistoricalPerformance.tsx` - component for displaying historical metrics

## Key Considerations & Challenges

### Performance Optimization

- **lazy loading** - validators are loaded on-demand to reduce initial loading time
- **data caching** - validator data is cached to prevent redundant API calls
- **pagination** - implemented pagination to handle large validator sets efficiently
- **background processing** - APY calculations are performed in the background to keep the UI responsive

### APY Calculation Accuracy

calculating accurate APY was a significant focus:

- era rewards are distributed proportionally based on era points
- commission rates are applied to determine nominator rewards
- historical APY is calculated using actual stake and reward data from previous eras
- both "all eras" and "active eras only" averages are provided for better insight

### Trade-offs and Compromises

- no wallet connection functionality (this would be a priority for a future update)
- limited error handling in some edge cases
- no persistent storage (refreshing loses state)
- no comprehensive testing suite

## Running the Project

### Prerequisites

- Node.js (v18 or later)
- Yarn or npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/polkadot-validator-rewards-analyzer.git
cd polkadot-validator-rewards-analyzer
```

2. Install dependencies:
```bash
yarn install
# or
npm install

npx papi
```

3. Start the development server:
```bash
yarn dev
# or
npm run dev
```

4. Open your browser to `http://localhost:5173`

### Building for Production

```bash
yarn build
# or
npm run build
```

## Future Improvements

given more time, I would enhance the dAPP with:

1. **Wallet Integration** - connect with Polkadot browser extension to populate user accounts
2. **Nominator Status Check** - show whether an address can nominate and current nomination status
3. **Minimum Staking Amount Calculation** - display minimum token requirement per era
4. **Bag Management** - help users fix reward issues by managing staking bags
5. **Nomination Management** - allow users to nominate validators directly from the app
6. **Offline Support** - cache data for offline viewing
7. **Testing** - add comprehensive unit and integration tests
8. **SDK Abstraction** - break out the chain business logic into a reusable SDK

## Contributions

contributions are welcome - feel free to submit a PR

## License

this project is licensed under the MIT License - see the LICENSE file for details.# polkadot-staking-rewards-analyzer
