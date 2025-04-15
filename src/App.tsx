import React from 'react';
import { useValidatorData } from './hooks/useValidatorData';
import { ValidatorTable } from './components/ValidatorTable';
import { HistoricalPerformance } from './components/HistoricalPerformance';

/**
 * main app component
 * - handle data fetching via hook
 * - main layout
 * - passing data and callbacks to child components
 */
const App: React.FC = () => {
  // get all validator data and actions from hook
  const {
    validators,
    currentPage,
    pageSize,
    totalPages,
    totalValidators,
    activeEra,
    lastEra,
    historicalEras,
    loading,
    loadingPage,
    calculatingAPY,
    error,
    fetchPage,
    setPageSize,
    includeFullCommission,
    includeBlockedNominations,
    setFilterOptions,
    selectedHistoricalValidator,
    setSelectedHistoricalValidator
  } = useValidatorData();

  // handler for validator selection in the table
  const handleValidatorSelect = (address: string) => {
    setSelectedHistoricalValidator(address);
  };

  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-gray-100">
      <div className="w-full max-w-fit px-14 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          Polkadot Staking Rewards Analyzer
        </h1>

        {/* error display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* initial loading state */}
        {loading && validators.length === 0 && (
          <div className="text-center p-8 bg-white rounded-lg shadow-md">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4">Loading validator data...</p>
            <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
          </div>
        )}

        {/* main content - only show when we have data */}
        {validators.length > 0 && (
          <div className="grid grid-cols-12 gap-6 w-full">
            {/* main validator table */}
            <div className="col-span-12 lg:col-span-8">
              <ValidatorTable
                validators={validators}
                activeEra={activeEra}
                lastEra={lastEra}
                currentPage={currentPage}
                totalPages={totalPages}
                totalValidators={totalValidators}
                pageSize={pageSize}
                isLoading={loading || loadingPage}
                calculatingAPY={calculatingAPY}
                includeFullCommission={includeFullCommission}
                includeBlockedNominations={includeBlockedNominations}
                selectedHistoricalValidator={selectedHistoricalValidator}
                onPageChange={fetchPage}
                onPageSizeChange={setPageSize}
                onFilterChange={setFilterOptions}
                onValidatorSelect={handleValidatorSelect}
              />
            </div>

            {/* historical performance sidebar */}
            <div className="col-span-12 lg:col-span-4">
              <HistoricalPerformance
                validators={validators}
                historicalEras={historicalEras}
                activeEra={activeEra}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;