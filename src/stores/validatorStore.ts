import { create } from 'zustand';
import { typedApi } from '../utils/api';

// main interface for validator data
export interface Validator {
    address: string;
    commission: number;           // commission percentage (0-1 range)
    blockedNominations: boolean;  // is alidator is accepting nominations?
    totalStake: bigint;           // total amount staked including own stake
    ownStake: bigint;             // vals own stake / skin in the game
    lastEraAPY: number;           // calc APY for last era
    performance: {
        currentEraPoints: number;
        previousErasPoints: Record<number, number>;  // era number → points mapping
        averagePoints: number;
    };
    rewards: {
        currentEraReward: bigint;
        previousErasRewards: Record<number, bigint>; // era number → reward mapping
        apyByEra: Record<number, number>;            // era number → APY mapping
        averageAPY: number;                          // average across all eras (including inactive)
        activeOnlyAverageAPY: number;                // average only active eras
    };
    historicalCommission: Record<number, number>;   // historical commission rates by era
    averageCommission: number;
}

/**
 * validator store state and actions
 * using zustand for state
 */
interface ValidatorState {
    currentPage: number;
    pageSize: number;
    totalValidators: number;
    allValidators: Array<{ address: string; points: number }>;  // all validators info
    filteredValidators: Array<{ address: string; points: number; lastEraAPY?: number }>;  // filtered list based on user selection
    displayedValidators: Validator[];  // fully hydrated validator data for the current page
    validatorCache: Record<string, Validator>;  // cache to avoid too many api calls
    prefetchSize: number;  // number of validators to prefetch
    activeEra: number;
    lastEra: number;
    currentEraReward: bigint;
    currentEraPoints: any;
    historicalEras: number[];  // list of eras for historical data
    historyLength: number;     // wow many eras back to show
    maxHistoryLength: number;  // max possible eras that are stored on chain
    selectedHistoricalValidator: string | null;
    includeFullCommission: boolean;
    includeBlockedNominations: boolean;
    loading: boolean;
    loadingPage: boolean;
    loadingAPY: boolean;
    loadingHistoricalData: boolean;
    calculatingLastEraAPY: boolean;
    lastEraAPYCalculated: boolean;
    error: string | null;

    // actions
    fetchAllValidators: () => Promise<void>;
    fetchValidatorPage: (page: number) => Promise<void>;
    fetchHistoricalPerformance: (validatorAddress: string, forceRefresh?: boolean) => Promise<void>;
    calculateValidatorAPY: (validatorAddress: string) => Promise<void>;
    calculateLastEraAPYForAllValidators: () => Promise<void>;
    calculateAverages: (validatorAddress: string) => void;
    setPageSize: (size: number) => void;
    setHistoryLength: (length: number) => Promise<void>;
    setSelectedHistoricalValidator: (address: string | null) => Promise<void>;
    setFilterOptions: (options: { includeFullCommission?: boolean, includeBlockedNominations?: boolean }) => void;
    applyFilters: () => Promise<void>;
    prefetchValidators: () => Promise<void>;
}

/**
 * main Zustand store for validator data
 * most components get data from here
 */
export const useValidatorStore = create<ValidatorState>((set, get) => ({
    // initial vals
    currentPage: 1,
    pageSize: 10,
    totalValidators: 0,
    allValidators: [],
    filteredValidators: [],
    displayedValidators: [],
    validatorCache: {},
    prefetchSize: 100,  // prefetch 100 validators at a time - found this to be a good balance
    activeEra: 0,
    lastEra: 0,
    currentEraReward: 0n,
    currentEraPoints: null,
    historicalEras: [],
    historyLength: 20,  // default to 20 eras
    maxHistoryLength: 84,  // polkadot stores 84 eras of history
    selectedHistoricalValidator: null,
    includeFullCommission: false,
    includeBlockedNominations: false,
    loading: false,
    loadingPage: false,
    loadingAPY: false,
    loadingHistoricalData: false,
    calculatingLastEraAPY: false,
    lastEraAPYCalculated: false,
    error: null,

    // updates the page size and fetches the first page
    setPageSize: (size: number) => {
        set({ pageSize: size });
        get().fetchValidatorPage(1);
    },

    /**
     * calcs average performance metrics for a specific validator
     * including points, APY, and average commission
     */
    calculateAverages: (validatorAddress: string) => {
        const { displayedValidators, historicalEras } = get();
        const validator = displayedValidators.find(v => v.address === validatorAddress);

        if (!validator) return;

        let pointsSum = 0;
        let pointsCount = 0;
        let commissionSum = 0;
        let commissionCount = 0;
        let apySum = 0;
        let apyCount = 0;

        // loop through all eras to calc averages
        historicalEras.forEach(era => {
            const wasActive = validator.performance.previousErasPoints[era] > 0;

            if (wasActive) {
                pointsSum += validator.performance.previousErasPoints[era];
                pointsCount++;

                if (validator.historicalCommission[era] !== undefined) {
                    commissionSum += validator.historicalCommission[era];
                    commissionCount++;
                }
            }

            if (validator.rewards.apyByEra[era]) {
                apySum += validator.rewards.apyByEra[era];
                apyCount++;
            }
        });

        // calc the averages or use defaults if no data
        const averagePoints = pointsCount > 0 ? pointsSum / pointsCount : 0;
        const averageCommission = commissionCount > 0 ? commissionSum / commissionCount : validator.commission;
        const averageAPY = apyCount > 0 ? apySum / apyCount : 0;

        // update validator with the averages
        const updatedValidators = displayedValidators.map(v => {
            if (v.address === validatorAddress) {
                return {
                    ...v,
                    performance: {
                        ...v.performance,
                        averagePoints
                    },
                    rewards: {
                        ...v.rewards,
                        averageAPY
                    },
                    averageCommission
                };
            }
            return v;
        });

        set({ displayedValidators: updatedValidators });

        // update cache
        const { validatorCache } = get();
        set({
            validatorCache: {
                ...validatorCache,
                [validatorAddress]: updatedValidators.find(v => v.address === validatorAddress)!
            }
        });
    },

    /**
     * updates history length and if needed: refresh data
     * cap at maxHistoryLength since that's what the chain stores
     */
    setHistoryLength: async (length: number) => {
        const newLength = Math.max(1, Math.min(length, get().maxHistoryLength));
        set({ historyLength: newLength });

        const { selectedHistoricalValidator } = get();
        if (selectedHistoricalValidator) {
            // refresh data with the new length
            await get().fetchHistoricalPerformance(selectedHistoricalValidator, true);
            await get().calculateValidatorAPY(selectedHistoricalValidator);
        }
    },

    /**
     * setselected validator for historical performance view
     * fetch historical data
     */
    setSelectedHistoricalValidator: async (address: string | null) => {
        set({ selectedHistoricalValidator: address });

        if (address) {
            await get().fetchHistoricalPerformance(address, false);
            await get().calculateValidatorAPY(address);
        }
    },

    // update and reapply filters
    setFilterOptions: (options) => {
        set({
            includeFullCommission: options.includeFullCommission !== undefined
                ? options.includeFullCommission
                : get().includeFullCommission,
            includeBlockedNominations: options.includeBlockedNominations !== undefined
                ? options.includeBlockedNominations
                : get().includeBlockedNominations
        });

        // apply filters and fetch first page
        get().applyFilters().then(() => get().fetchValidatorPage(1));
    },

    /**
     * apply filters to all validators
     * using batch processing to avoid UI freezing
     */
    applyFilters: async () => {
        const {
            allValidators,
            includeFullCommission,
            includeBlockedNominations,
            validatorCache,
            lastEraAPYCalculated
        } = get();

        set({ loadingPage: true });

        try {
            let filteredResults = [];

            // if all filters are on, just use all validators
            if (includeFullCommission && includeBlockedNominations) {
                filteredResults = [...allValidators];
            } else {
                // check each validator against filters
                const batchSize = 50; // using batch processing to avoid UI freezing

                for (let i = 0; i < allValidators.length; i += batchSize) {
                    const batch = allValidators.slice(i, i + batchSize);
                    const batchResults = await Promise.all(batch.map(async ({ address, points }) => {
                        try {
                            // check cache first so we dont have to call api again
                            const cached = validatorCache[address];
                            if (cached) {
                                if (!includeFullCommission && cached.commission >= 1.0) return null;
                                if (!includeBlockedNominations && cached.blockedNominations) return null;
                                return {
                                    address,
                                    points,
                                    lastEraAPY: cached.lastEraAPY || 0
                                };
                            }

                            // not in cache, fetch from val prefs
                            const prefs = await typedApi.query.Staking.Validators.getValue(address);
                            const commissionValue = prefs?.commission || 0n;
                            const commission = Number(commissionValue) / 1_000_000_000;
                            const blockedNominations = prefs?.blocked || false;

                            if (!includeFullCommission && commission >= 1.0) return null;
                            if (!includeBlockedNominations && blockedNominations) return null;

                            const cachedValidator = validatorCache[address];
                            return {
                                address,
                                points,
                                lastEraAPY: cachedValidator?.lastEraAPY || 0
                            };
                        } catch {
                            // show default values when fetch fails
                            return {
                                address,
                                points,
                                lastEraAPY: 0
                            };
                        }
                    }));

                    filteredResults.push(...batchResults.filter(Boolean));
                }
            }

            // sort by APY
            if (lastEraAPYCalculated) {
                filteredResults = filteredResults.sort((a, b) => {
                    const aValidator = a ? validatorCache[a.address] : null;
                    const bValidator = b ? validatorCache[b.address] : null;

                    const aApy = aValidator?.lastEraAPY || 0;
                    const bApy = bValidator?.lastEraAPY || 0;

                    return bApy - aApy; // higehst APY first
                });
            }

            set({
                filteredValidators: filteredResults.filter((v): v is { address: string; points: number; lastEraAPY?: number } => v !== null),
                totalValidators: filteredResults.length,
                loadingPage: false
            });

            // check if we need to calculate APY for new validators
            const newValidatorsWithoutAPY = filteredResults.some(v => {
                if (!v) return false;
                const cachedValidator = validatorCache[v.address];
                return !cachedValidator || cachedValidator.lastEraAPY === undefined;
            });

            // queue APY calculation if needed (using setTimeout to avoid blocking UI)
            if (newValidatorsWithoutAPY && !get().calculatingLastEraAPY) {
                setTimeout(() => get().calculateLastEraAPYForAllValidators(), 500);
            }
        } catch (error) {
            set({
                error: (error as Error).message,
                loadingPage: false,
                filteredValidators: [...allValidators], // fall back to all validators on error
                totalValidators: allValidators.length
            });
        }
    },

    /**
     * fetch all validators from chain
     * main entry point for data loading
     */
    fetchAllValidators: async () => {
        set({ loading: true, error: null });
        try {
            // get active era
            const activeEraResult = await typedApi.query.Staking.ActiveEra.getValue();
            if (!activeEraResult) throw new Error("failed gettin the active era...");

            const activeEra = Number(activeEraResult.index);
            const lastEra = activeEra - 1;
            const maxHistory = Math.min(84, activeEra); // polkadot stores 84 eras of history

            // get current era rewards and validator list
            const eraReward = await typedApi.query.Staking.ErasValidatorReward.getValue(activeEra);
            const validatorAddresses = await typedApi.query.Session.Validators.getValue();
            const eraRewardPoints = await typedApi.query.Staking.ErasRewardPoints.getValue(activeEra);

            // process points data
            const pointsMap: Record<string, number> = {};
            if (eraRewardPoints?.individual) {
                const individualPoints = Array.isArray(eraRewardPoints.individual)
                    ? eraRewardPoints.individual
                    : [];

                individualPoints.forEach(entry => {
                    if (Array.isArray(entry) && entry.length === 2) {
                        const [address, points] = entry;
                        pointsMap[address.toString()] = Number(points);
                    }
                });
            }

            // list of all validators with their points
            const allValidators = validatorAddresses.map(address => ({
                address: address.toString(),
                points: pointsMap[address.toString()] || 0
            }));

            // sort by points (highest pts first)
            allValidators.sort((a, b) => b.points - a.points);

            set({
                allValidators,
                activeEra,
                lastEra,
                maxHistoryLength: maxHistory,
                currentEraReward: eraReward || 0n,
                currentEraPoints: eraRewardPoints,
                loading: false
            });

            // apply filters and load first page
            await get().applyFilters();
            await get().fetchValidatorPage(1);

            // queue APY calculation 
            // using setTimeout to not block the UI
            setTimeout(() => {
                get().calculateLastEraAPYForAllValidators();
            }, 1000);

            // prefetch additional validator details in the background
            setTimeout(() => {
                get().prefetchValidators();
            }, 2000);
        } catch (error) {
            set({ error: (error as Error).message, loading: false });
        }
    },

    /**
     * calc APY for all validators based on last era data
     * using batch processing to avoid UI freezing
     */
    calculateLastEraAPYForAllValidators: async () => {
        const { allValidators, validatorCache, lastEra } = get();

        set({ calculatingLastEraAPY: true, lastEraAPYCalculated: false });

        try {
            // get era reward & points
            const eraReward = await typedApi.query.Staking.ErasValidatorReward.getValue(lastEra);
            if (!eraReward) {
                set({ calculatingLastEraAPY: false });
                return;
            }

            const eraPoints = await typedApi.query.Staking.ErasRewardPoints.getValue(lastEra);
            if (!eraPoints?.individual || !eraPoints.total) {
                set({ calculatingLastEraAPY: false });
                return;
            }

            const totalEraPoints = Number(eraPoints.total);
            const individualPoints: Record<string, number> = {};

            // get individual points
            if (Array.isArray(eraPoints.individual)) {
                eraPoints.individual.forEach(entry => {
                    if (Array.isArray(entry) && entry.length === 2) {
                        const [address, points] = entry;
                        individualPoints[address.toString()] = Number(points);
                    }
                });
            }

            // using batch processing to avoid UI freezing
            const batchSize = 25;
            const newCacheEntries: Record<string, Validator> = {};
            const validatorsWithAPY: { address: string; points: number; lastEraAPY: number }[] = [];

            for (let i = 0; i < allValidators.length; i += batchSize) {
                const batch = allValidators.slice(i, i + batchSize);

                const batchResults = await Promise.all(batch.map(async (validator) => {
                    const { address } = validator;
                    try {
                        // check if we already have the APY calculated
                        const existingValidator = validatorCache[address];
                        if (existingValidator && typeof existingValidator.lastEraAPY === 'number' && existingValidator.lastEraAPY > 0) {
                            return {
                                address,
                                lastEraAPY: existingValidator.lastEraAPY,
                                validatorInstance: existingValidator
                            };
                        }

                        const validatorPoints = individualPoints[address] || 0;

                        // get validator prefs for the era
                        const validatorPrefs = await typedApi.query.Staking.ErasValidatorPrefs.getValue(lastEra, address);
                        const commissionValue = validatorPrefs?.commission || 0n;
                        const commission = Number(commissionValue) / 1_000_000_000;
                        const blockedNominations = validatorPrefs?.blocked || false;

                        // get stake info
                        const stakersOverview = await typedApi.query.Staking.ErasStakersOverview.getValue(lastEra, address);
                        if (!stakersOverview || !stakersOverview.total || stakersOverview.total === 0n) {
                            return {
                                address,
                                lastEraAPY: 0,
                                validatorInstance: existingValidator ? {
                                    ...existingValidator,
                                    lastEraAPY: 0
                                } : null
                            };
                        }

                        const totalStake = stakersOverview.total;

                        // calc APY
                        let apy = 0;
                        if (validatorPoints > 0) {
                            // APY ccalc formula:
                            // 1. calculate validators share of era rewards based on points
                            // 2. remove commission
                            // 3. calc return rate for the era
                            // 4. annualize by multiplying by 365.25 days
                            const pointsRatio = validatorPoints / totalEraPoints;
                            const validatorReward = BigInt(Math.floor(Number(eraReward) * pointsRatio));

                            const commissionPart = BigInt(Math.floor(commission * 1_000_000_000));
                            const nominatorRatio = 1_000_000_000n - commissionPart;
                            const nominatorReward = (validatorReward * nominatorRatio) / 1_000_000_000n;

                            const eraReturnRate = Number(nominatorReward) / Number(totalStake);
                            apy = eraReturnRate * 365.25 * 100; // convert to percentage and annualize
                        }

                        if (existingValidator) {
                            const updatedValidator = {
                                ...existingValidator,
                                lastEraAPY: apy,
                                commission,
                                blockedNominations
                            };

                            newCacheEntries[address] = updatedValidator;
                            return {
                                address,
                                lastEraAPY: apy,
                                validatorInstance: updatedValidator
                            };
                        }

                        return {
                            address,
                            lastEraAPY: apy,
                            validatorInstance: null
                        };
                    } catch {
                        return {
                            address,
                            lastEraAPY: 0,
                            validatorInstance: null
                        };
                    }
                }));

                batchResults.forEach(({ address, lastEraAPY, validatorInstance }) => {
                    validatorsWithAPY.push({ address, points: 0, lastEraAPY });

                    if (validatorInstance) {
                        newCacheEntries[address] = validatorInstance;
                    }
                });

                // update cache in batches
                if (Object.keys(newCacheEntries).length > 0) {
                    set(state => ({
                        validatorCache: {
                            ...state.validatorCache,
                            ...newCacheEntries
                        }
                    }));
                }
            }

            // update validator lists with calculated APYs
            set(state => {
                const apyMap = new Map<string, number>();
                validatorsWithAPY.forEach(v => apyMap.set(v.address, v.lastEraAPY));

                const updatedFiltered = state.filteredValidators.map(v => ({
                    ...v,
                    lastEraAPY: apyMap.get(v.address) || 0
                }));

                // sort by APY - highest first
                updatedFiltered.sort((a, b) => (b.lastEraAPY || 0) - (a.lastEraAPY || 0));

                const updatedDisplayed = state.displayedValidators.map(v => ({
                    ...v,
                    lastEraAPY: apyMap.get(v.address) || 0
                }));

                return {
                    filteredValidators: updatedFiltered,
                    displayedValidators: updatedDisplayed,
                    lastEraAPYCalculated: true,
                    calculatingLastEraAPY: false
                };
            });

            // reload page with up to date APY
            await get().fetchValidatorPage(1);

        } catch (error) {
            set({
                calculatingLastEraAPY: false,
                error: `calculation error for apy calcs: ${(error as Error).message}`
            });
        }
    },

    /**
     * perfetch validator details in the background
     * trying to speed up loading time
     */
    prefetchValidators: async () => {
        const { filteredValidators, validatorCache, prefetchSize, activeEra, currentEraPoints } = get();
        if (filteredValidators.length === 0) return;

        try {
            // only prefetch validators if not in cache
            const toPrefetch = filteredValidators
                .filter(v => !validatorCache[v.address])
                .slice(0, prefetchSize);

            if (toPrefetch.length === 0) {
                return;
            }

            // using batch processing to avoid UI freezing
            const batchSize = 10;
            const newCacheEntries: Record<string, Validator> = {};

            for (let i = 0; i < toPrefetch.length; i += batchSize) {
                const batch = toPrefetch.slice(i, i + batchSize);
                const batchResults = await Promise.all(batch.map(async ({ address, points, lastEraAPY }) => {
                    try {
                        // get val prefs (commission, blocked status)
                        const prefs = await typedApi.query.Staking.Validators.getValue(address);
                        const commissionValue = prefs?.commission || 0n;
                        const commission = Number(commissionValue) / 1_000_000_000;
                        const blockedNominations = prefs?.blocked || false;

                        // get stake information 
                        let totalStake = 0n, ownStake = 0n;
                        try {
                            const stakersOverview = await typedApi.query.Staking.ErasStakersOverview.getValue(activeEra, address);
                            if (stakersOverview && stakersOverview.total > 0n) {
                                totalStake = stakersOverview.total;
                                ownStake = stakersOverview.own || 0n;
                            }
                        } catch { }

                        // calc current era rewards if possible
                        let validatorReward = 0n;
                        if (get().currentEraReward && points > 0 && currentEraPoints?.total > 0) {
                            const totalEraPoints = Number(currentEraPoints.total);
                            const pointsRatio = points / totalEraPoints;
                            const fixedPointMultiplier = 1_000_000n; // fixed point for BigInt calcs
                            const ratioFixed = BigInt(Math.floor(pointsRatio * Number(fixedPointMultiplier)));
                            validatorReward = (ratioFixed * get().currentEraReward) / fixedPointMultiplier;
                        }

                        return {
                            address,
                            validator: {
                                address,
                                commission,
                                blockedNominations,
                                totalStake,
                                ownStake,
                                lastEraAPY: lastEraAPY || 0,
                                performance: {
                                    currentEraPoints: points,
                                    previousErasPoints: {},
                                    averagePoints: 0
                                },
                                rewards: {
                                    currentEraReward: validatorReward,
                                    previousErasRewards: {},
                                    apyByEra: {},
                                    averageAPY: 0,
                                    activeOnlyAverageAPY: 0
                                },
                                historicalCommission: {},
                                averageCommission: commission
                            }
                        };
                    } catch {
                        // default validator object if fetch fails
                        return {
                            address,
                            validator: {
                                address,
                                commission: 0,
                                blockedNominations: false,
                                totalStake: 0n,
                                ownStake: 0n,
                                lastEraAPY: lastEraAPY || 0,
                                performance: {
                                    currentEraPoints: points,
                                    previousErasPoints: {},
                                    averagePoints: 0
                                },
                                rewards: {
                                    currentEraReward: 0n,
                                    previousErasRewards: {},
                                    apyByEra: {},
                                    averageAPY: 0,
                                    activeOnlyAverageAPY: 0
                                },
                                historicalCommission: {},
                                averageCommission: 0
                            }
                        };
                    }
                }));

                batchResults.forEach(({ address, validator }) => {
                    newCacheEntries[address] = validator;
                });

                // update cache with batch
                set(state => ({
                    validatorCache: {
                        ...state.validatorCache,
                        ...newCacheEntries
                    }
                }));
            }
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    /**
     * fetch val data for a specific page
     * hydrate the basic validator list with full details
     */
    fetchValidatorPage: async (page: number) => {
        const { filteredValidators, pageSize, activeEra, currentEraPoints, validatorCache } = get();
        if (filteredValidators.length === 0) return;

        set({ loadingPage: true, currentPage: page });

        try {
            const startIdx = (page - 1) * pageSize;
            const pageValidators = filteredValidators.slice(startIdx, startIdx + pageSize);

            // using batch processing to avoid UI freezing
            const batchSize = 10;
            const detailedValidators: Validator[] = [];

            for (let i = 0; i < pageValidators.length; i += batchSize) {
                const batch = pageValidators.slice(i, i + batchSize);
                const batchPromises = batch.map(async ({ address, points, lastEraAPY }) => {
                    // check cache
                    if (validatorCache[address]) {
                        const cached = validatorCache[address];
                        // if APY has change - update the cached validator
                        if (lastEraAPY !== undefined && cached.lastEraAPY !== lastEraAPY) {
                            const updatedValidator = {
                                ...cached,
                                lastEraAPY: lastEraAPY
                            };

                            set(state => ({
                                validatorCache: {
                                    ...state.validatorCache,
                                    [address]: updatedValidator
                                }
                            }));

                            return updatedValidator;
                        }
                        return cached;
                    }

                    // not in cache, fetch from val prefs
                    try {
                        // get val prefs
                        const prefs = await typedApi.query.Staking.Validators.getValue(address);
                        const commissionValue = prefs?.commission || 0n;
                        const commission = Number(commissionValue) / 1_000_000_000;
                        const blockedNominations = prefs?.blocked || false;

                        // get stake info
                        let totalStake = 0n, ownStake = 0n;
                        try {
                            const stakersOverview = await typedApi.query.Staking.ErasStakersOverview.getValue(activeEra, address);
                            if (stakersOverview && stakersOverview.total > 0n) {
                                totalStake = stakersOverview.total;
                                ownStake = stakersOverview.own || 0n;
                            }
                        } catch { }

                        // calc current era rewards
                        let validatorReward = 0n;
                        if (get().currentEraReward && points > 0 && currentEraPoints?.total > 0) {
                            const totalEraPoints = Number(currentEraPoints.total);
                            const pointsRatio = points / totalEraPoints;
                            const fixedPointMultiplier = 1_000_000n; // using fixed point for BigInt calcs
                            const ratioFixed = BigInt(Math.floor(pointsRatio * Number(fixedPointMultiplier)));
                            validatorReward = (ratioFixed * get().currentEraReward) / fixedPointMultiplier;
                        }

                        // new validator object with fetched data
                        const newValidator = {
                            address,
                            commission,
                            blockedNominations,
                            totalStake,
                            ownStake,
                            lastEraAPY: lastEraAPY || 0,
                            performance: {
                                currentEraPoints: points,
                                previousErasPoints: {},
                                averagePoints: 0
                            },
                            rewards: {
                                currentEraReward: validatorReward,
                                previousErasRewards: {},
                                apyByEra: {},
                                averageAPY: 0,
                                activeOnlyAverageAPY: 0
                            },
                            historicalCommission: {},
                            averageCommission: commission
                        };

                        // update cache
                        set(state => ({
                            validatorCache: {
                                ...state.validatorCache,
                                [address]: newValidator
                            }
                        }));

                        return newValidator;
                    } catch {
                        // default validator object if fetch fails
                        const newValidator = {
                            address,
                            commission: 0,
                            blockedNominations: false,
                            totalStake: 0n,
                            ownStake: 0n,
                            lastEraAPY: lastEraAPY || 0,
                            performance: {
                                currentEraPoints: points,
                                previousErasPoints: {},
                                averagePoints: 0
                            },
                            rewards: {
                                currentEraReward: 0n,
                                previousErasRewards: {},
                                apyByEra: {},
                                averageAPY: 0,
                                activeOnlyAverageAPY: 0
                            },
                            historicalCommission: {},
                            averageCommission: 0
                        };

                        set(state => ({
                            validatorCache: {
                                ...state.validatorCache,
                                [address]: newValidator
                            }
                        }));

                        return newValidator;
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                detailedValidators.push(...batchResults);
            }

            set({ displayedValidators: detailedValidators, loadingPage: false });
        } catch (error) {
            set({ error: (error as Error).message, loadingPage: false });
        }
    },

    /**
     * fetch historical performance data for a specific validator
     * including points, rewards, and commission for past eras
     */
    fetchHistoricalPerformance: async (validatorAddress: string, forceRefresh = false) => {
        const { activeEra, historyLength, validatorCache, displayedValidators } = get();
        if (!validatorAddress) return;

        set({ loadingHistoricalData: true });

        try {
            // array of eras to fetch, going back historyLength eras
            const historicalEras = Array.from(
                { length: historyLength },
                (_, i) => activeEra - i - 1
            ).filter(era => era >= 0);

            set({ historicalEras });

            // find validator in cache or displayed list
            const validator = validatorCache[validatorAddress] ||
                displayedValidators.find(v => v.address === validatorAddress);

            if (!validator) {
                set({ loadingHistoricalData: false });
                return;
            }

            // ff we already have enough data and don't need to refresh
            if (!forceRefresh &&
                Object.keys(validator.performance.previousErasPoints).length >= historicalEras.length) {
                set({ loadingHistoricalData: false });
                return;
            }

            // storage for historical data
            const validatorPerformance: Record<number, number> = {};
            const validatorRewards: Record<number, bigint> = {};
            const validatorCommissions: Record<number, number> = {};

            // using batch processing to avoid UI freezing
            const batchSize = 5;
            for (let i = 0; i < historicalEras.length; i += batchSize) {
                const eraBatch = historicalEras.slice(i, i + batchSize);

                await Promise.all(eraBatch.map(async (era) => {
                    try {
                        // get points and rewards for the era
                        const eraPoints = await typedApi.query.Staking.ErasRewardPoints.getValue(era);
                        const eraReward = await typedApi.query.Staking.ErasValidatorReward.getValue(era);

                        if (eraPoints?.individual) {
                            const individualPoints = Array.isArray(eraPoints.individual)
                                ? eraPoints.individual
                                : [];

                            // find validator points
                            let validatorPoints = 0;
                            for (const entry of individualPoints) {
                                if (Array.isArray(entry) && entry.length === 2) {
                                    const [address, points] = entry;
                                    if (address.toString() === validatorAddress) {
                                        validatorPoints = Number(points);
                                        validatorPerformance[era] = validatorPoints;

                                        // calc validators reward for this era
                                        if (eraReward && eraPoints.total > 0) {
                                            const totalPointsValue = Number(eraPoints.total);
                                            const pointsRatio = validatorPoints / totalPointsValue;
                                            const fixedPointMultiplier = 1_000_000n;
                                            const ratioFixed = BigInt(Math.floor(pointsRatio * Number(fixedPointMultiplier)));
                                            validatorRewards[era] = (ratioFixed * eraReward) / fixedPointMultiplier;
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                        // get commission for the era
                        try {
                            const validatorPrefs = await typedApi.query.Staking.ErasValidatorPrefs.getValue(era, validatorAddress);
                            if (validatorPrefs?.commission) {
                                const commission = Number(validatorPrefs.commission) / 1_000_000_000;
                                validatorCommissions[era] = commission;
                            }
                        } catch { }
                    } catch {
                        set({ error: `something went wrong fetching the era data for ${era}` });
                    }
                }));
            }

            // calc averages
            const historicalPointsArray = [];
            const commissionValues = [];

            for (const era of historicalEras) {
                if (validatorPerformance[era] !== undefined) {
                    historicalPointsArray.push(validatorPerformance[era]);
                }
                if (validatorCommissions[era] !== undefined) {
                    commissionValues.push(validatorCommissions[era]);
                }
            }

            const averagePoints = historicalPointsArray.length > 0
                ? historicalPointsArray.reduce((a, b) => a + b, 0) / historicalPointsArray.length
                : 0;

            const averageCommission = commissionValues.length > 0
                ? commissionValues.reduce((a, b) => a + b, 0) / commissionValues.length
                : validator.commission;

            // update with historical data
            const updatedValidator = {
                ...validator,
                performance: {
                    ...validator.performance,
                    previousErasPoints: validatorPerformance,
                    averagePoints
                },
                rewards: {
                    ...validator.rewards,
                    previousErasRewards: validatorRewards,
                    apyByEra: validator.rewards.apyByEra || {},
                    averageAPY: validator.rewards.averageAPY || 0,
                    activeOnlyAverageAPY: validator.rewards.activeOnlyAverageAPY || 0
                },
                historicalCommission: validatorCommissions,
                averageCommission
            };

            // update cache
            set(state => ({
                validatorCache: {
                    ...state.validatorCache,
                    [validatorAddress]: updatedValidator
                }
            }));

            // update displayed validators if this one is shown
            const updatedDisplayedValidators = displayedValidators.map(v =>
                v.address === validatorAddress ? updatedValidator : v
            );

            set({
                displayedValidators: updatedDisplayedValidators,
                loadingHistoricalData: false
            });
        } catch (error) {
            set({ error: (error as Error).message, loadingHistoricalData: false });
        }
    },

    /**
     * calc APY for each historical era for a validator
     * gives us the trend of APY over time
     */
    calculateValidatorAPY: async (validatorAddress: string) => {
        const { historicalEras, displayedValidators, validatorCache } = get();
        const validator = displayedValidators.find(v => v.address === validatorAddress) ||
            validatorCache[validatorAddress];

        if (!validator) return;

        set({ loadingAPY: true });

        try {
            const apyByEra: Record<number, number> = {};

            // using batch processing to avoid UI freezing
            const batchSize = 3;
            for (let i = 0; i < historicalEras.length; i += batchSize) {
                const batch = historicalEras.slice(i, i + batchSize);
                await Promise.all(batch.map(async (era) => {
                    try {
                        // get era reward
                        const eraReward = await typedApi.query.Staking.ErasValidatorReward.getValue(era);
                        if (!eraReward) return;

                        // get era points
                        const eraPoints = await typedApi.query.Staking.ErasRewardPoints.getValue(era);
                        if (!eraPoints?.individual) return;

                        // find validators points
                        let validatorPoints = 0;
                        const individualPoints = Array.isArray(eraPoints.individual)
                            ? eraPoints.individual
                            : [];

                        for (const entry of individualPoints) {
                            if (Array.isArray(entry) && entry.length === 2) {
                                const [address, points] = entry;
                                if (address.toString() === validatorAddress) {
                                    validatorPoints = Number(points);
                                    break;
                                }
                            }
                        }

                        if (validatorPoints === 0 || !eraPoints.total) return;

                        // get commission - use historical or current
                        const commission = validator.historicalCommission[era] || validator.commission;

                        // get stake information
                        const stakersOverview = await typedApi.query.Staking.ErasStakersOverview.getValue(era, validatorAddress);
                        if (!stakersOverview || !stakersOverview.total || stakersOverview.total === 0n) return;

                        const totalStake = stakersOverview.total;

                        // calc APY using the formula:
                        // 1. get validator's share of rewards based on points
                        // 2. minus commission
                        // 3. calculate return rate
                        // 4. annualize
                        const totalEraPoints = Number(eraPoints.total);
                        const pointsRatio = validatorPoints / totalEraPoints;
                        const validatorReward = BigInt(Math.floor(Number(eraReward) * pointsRatio));

                        const commissionPart = BigInt(Math.floor(commission * 1_000_000_000));
                        const nominatorRatio = 1_000_000_000n - commissionPart;
                        const nominatorReward = (validatorReward * nominatorRatio) / 1_000_000_000n;

                        const eraReturnRate = Number(nominatorReward) / Number(totalStake);
                        const apy = eraReturnRate * 365.25 * 100; // annualize and convert to percentage

                        apyByEra[era] = apy;
                    } catch {
                        set({ error: `APY calc error for era ${era}` });
                    }
                }));
            }

            // calc averages
            const apyValues = Object.values(apyByEra);
            const averageAPY = apyValues.length > 0
                ? apyValues.reduce((sum, val) => sum + val, 0) / apyValues.length
                : 0;

            // calc average only for eras where validator was active
            const activeApyValues = Object.values(apyByEra).filter(apy => apy > 0);
            const activeOnlyAverageAPY = activeApyValues.length > 0
                ? activeApyValues.reduce((sum, val) => sum + val, 0) / activeApyValues.length
                : 0;

            // update validators with APY data
            const updatedValidators = displayedValidators.map(v => {
                if (v.address === validatorAddress) {
                    return {
                        ...v,
                        rewards: {
                            ...v.rewards,
                            apyByEra,
                            averageAPY,
                            activeOnlyAverageAPY
                        }
                    };
                }
                return v;
            });

            const updatedValidator = {
                ...validator,
                rewards: {
                    ...validator.rewards,
                    apyByEra,
                    averageAPY,
                    activeOnlyAverageAPY
                }
            };

            // update state
            set(state => ({
                displayedValidators: updatedValidators,
                validatorCache: {
                    ...state.validatorCache,
                    [validatorAddress]: updatedValidator
                },
                loadingAPY: false
            }));

            // calculate other averages
            get().calculateAverages(validatorAddress);
        } catch (error) {
            set({ loadingAPY: false });
        }
    }
}));