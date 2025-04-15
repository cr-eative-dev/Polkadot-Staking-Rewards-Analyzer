import React from 'react';
import { Validator } from '../stores/validatorStore';
import { formatDOT } from '../utils/api';
import { Pagination } from './Pagination';

//validator table props
interface ValidatorTableProps {
    validators: Validator[];
    activeEra: number;
    lastEra: number;
    currentPage: number;
    totalPages: number;
    totalValidators: number;
    pageSize: number;
    isLoading: boolean;
    calculatingAPY: boolean;
    includeFullCommission: boolean;
    includeBlockedNominations: boolean;
    selectedHistoricalValidator: string | null;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    onFilterChange: (options: { includeFullCommission?: boolean, includeBlockedNominations?: boolean }) => void;
    onValidatorSelect?: (address: string) => void;
}

/**
 * show all validators in a table
 * 
 * main component for browsing validator data. showing the key metrics
 * like commission, stake amounts, and APY to help users choose validators.
 */
export const ValidatorTable: React.FC<ValidatorTableProps> = ({
    validators,
    activeEra,
    lastEra,
    currentPage,
    totalPages,
    totalValidators,
    pageSize,
    isLoading,
    calculatingAPY,
    includeFullCommission,
    includeBlockedNominations,
    selectedHistoricalValidator,
    onPageChange,
    onPageSizeChange,
    onFilterChange,
    onValidatorSelect
}) => {
    // calc indexes (for example "sowing 1-10 of 300 validators")
    const startIdx = (currentPage - 1) * pageSize + 1;
    const endIdx = Math.min(startIdx + validators.length - 1, totalValidators);

    // formats APY value with color coding based on performance
    const formatAPY = (apy: number) => {
        const formattedAPY = apy.toFixed(2) + '%';
        let classes = "font-medium ";
        if (apy >= 14) classes += "text-green-600";
        else if (apy >= 10) classes += "text-green-500";
        else if (apy >= 7) classes += "text-yellow-500";
        else if (apy > 0) classes += "text-orange-500";
        else classes += "text-gray-500";
        return <span className={classes}>{formattedAPY}</span>;
    };

    // handles clicks on validator address to view historical perf
    const handleValidatorClick = (address: string) => {
        if (onValidatorSelect) {
            onValidatorSelect(address);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <h2 className="text-xl font-bold mb-2">Active Validators (Era {activeEra})</h2>

            <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                    <p className="text-sm text-gray-600">
                        Displaying {startIdx}-{endIdx} of {totalValidators} validators sorted by Last Era APY
                    </p>

                    {/* select page size */}
                    <div className="flex items-center space-x-2">
                        <label className="text-sm">
                            Validators per page:
                            <select
                                className="ml-2 p-1 border rounded"
                                value={pageSize}
                                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                                disabled={isLoading}
                            >
                                {[10, 20, 50, 100].map((size) => {
                                    return (
                                        <option key={size} value={size}>
                                            {size}
                                        </option>
                                    );
                                })}
                            </select>
                        </label>
                    </div>
                </div>

                {/* filters */}
                <div className="flex flex-wrap gap-4">
                    <label className="inline-flex items-center text-sm cursor-pointer">
                        <input
                            type="checkbox"
                            className="form-checkbox h-4 w-4 text-blue-600 mr-2"
                            checked={includeFullCommission}
                            onChange={(e) => onFilterChange({ includeFullCommission: e.target.checked })}
                            disabled={isLoading}
                        />
                        Include 100% commission validators
                    </label>

                    <label className="inline-flex items-center text-sm cursor-pointer">
                        <input
                            type="checkbox"
                            className="form-checkbox h-4 w-4 text-blue-600 mr-2"
                            checked={includeBlockedNominations}
                            onChange={(e) => onFilterChange({ includeBlockedNominations: e.target.checked })}
                            disabled={isLoading}
                        />
                        Include validators that don't allow nominations
                    </label>
                </div>
            </div>

            {/* calc APY indicator */}
            {calculatingAPY && (
                <div className="text-sm text-blue-600 mb-4 flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                    Calculating Last Era ({lastEra}) APY for all validators...
                </div>
            )}

            {/* initial loading state */}
            {isLoading && validators.length === 0 ? (
                <div className="text-center p-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading validators...</p>
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border p-2 text-left">Rank</th>
                                    <th className="border p-2 text-left">Address</th>
                                    <th className="border p-2 text-right">Commission</th>
                                    <th className="border p-2 text-right">Total Stake</th>
                                    <th className="border p-2 text-right">Own Stake</th>
                                    <th className="border p-2 text-right">Last Era APY</th>
                                </tr>
                            </thead>
                            <tbody className={isLoading ? "opacity-50" : ""}>
                                {validators.map((validator, index) => (
                                    <tr key={validator.address} className="hover:bg-gray-50">
                                        <td className="border p-2">{startIdx + index}</td>
                                        {/* clickable address that gets green when selected to show user what is selected */}
                                        <td
                                            className={`border p-2 font-mono text-sm cursor-pointer hover:text-blue-600 hover:underline ${validator.address === selectedHistoricalValidator ? 'bg-green-100' : ''}`}
                                            onClick={() => handleValidatorClick(validator.address)}
                                        >
                                            {/* shorten address for better display/ui */}
                                            {validator.address.substring(0, 8)}...{validator.address.substring(validator.address.length - 8)}
                                        </td>
                                        <td className="border p-2 text-right">{(validator.commission * 100).toFixed(2)}%</td>
                                        <td className="border p-2 text-right">{formatDOT(validator.totalStake)}</td>
                                        <td className="border p-2 text-right">{formatDOT(validator.ownStake)}</td>
                                        <td className="border p-2 text-right">
                                            {formatAPY(validator.lastEraAPY || 0)}
                                        </td>
                                    </tr>
                                ))}
                                {validators.length === 0 && !isLoading && (
                                    <tr>
                                        <td colSpan={6} className="border p-4 text-center">
                                            No validators match the current filter criteria
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* page contrls */}
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={onPageChange}
                        isLoading={isLoading}
                    />

                    {/* loading for page change */}
                    {isLoading && (
                        <div className="text-center py-2">
                            <p className="text-sm text-gray-600">Loading page {currentPage}...</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};