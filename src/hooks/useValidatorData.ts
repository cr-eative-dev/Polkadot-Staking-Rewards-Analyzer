import { useEffect } from 'react';
import { useValidatorStore } from '../stores/validatorStore';

/**
 * custom hook for validator store ///
 * handles nitial data fetching and and data store for ui
 */
export const useValidatorData = () => {
    const {
        allValidators,
        filteredValidators,
        displayedValidators,
        activeEra,
        lastEra,
        historicalEras,
        currentPage,
        pageSize,
        totalValidators,
        loading,
        loadingPage,
        calculatingLastEraAPY,
        error,
        fetchAllValidators,
        fetchValidatorPage,
        setPageSize,
        includeFullCommission,
        includeBlockedNominations,
        setFilterOptions,
        selectedHistoricalValidator,
        setSelectedHistoricalValidator
    } = useValidatorStore();

    // load initial data when component mounts
    useEffect(() => {
        fetchAllValidators();
    }, [fetchAllValidators]);

    // combined loadinf states
    const isLoading = loading || loadingPage || calculatingLastEraAPY;

    // return data and actions to the components
    return {
        validators: displayedValidators,
        allValidatorsCount: allValidators.length,
        filteredValidatorsCount: filteredValidators.length,
        currentPage,
        pageSize,
        totalValidators,
        totalPages: Math.ceil(totalValidators / pageSize),
        activeEra,
        lastEra,
        historicalEras,
        loading: isLoading,
        loadingPage,
        calculatingAPY: calculatingLastEraAPY,
        error,
        fetchPage: fetchValidatorPage,
        setPageSize,
        includeFullCommission,
        includeBlockedNominations,
        setFilterOptions,
        selectedHistoricalValidator,
        setSelectedHistoricalValidator
    };
};