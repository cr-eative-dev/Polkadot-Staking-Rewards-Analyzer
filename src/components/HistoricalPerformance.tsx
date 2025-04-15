import React, { useState, useMemo } from 'react';
import { Validator, useValidatorStore } from '../stores/validatorStore';
import { formatDOT } from '../utils/api';

/**
 * histPerformance props
 */
interface HistoricalPerformanceProps {
    validators: Validator[];
    historicalEras: number[];
    activeEra: number;
}

/**
 * display historical data for the selected validator ///
 * user can see trends over time for metrics like era points, rewards,
 * commission rates, and APY - that way the user can check how the validator did in the past and it the performance is consistent.
 */
export const HistoricalPerformance: React.FC<HistoricalPerformanceProps> = ({
    validators,
    historicalEras
}) => {
    // gettin state and functions froms zustand store
    const {
        loadingAPY,
        loadingHistoricalData,
        historyLength,
        maxHistoryLength,
        setHistoryLength,
        selectedHistoricalValidator,
        setSelectedHistoricalValidator
    } = useValidatorStore();

    // local ui state
    const [showInactiveEras, setShowInactiveEras] = useState<boolean>(false);

    // find selected validator from the list
    const validator = validators.find(v => v.address === selectedHistoricalValidator);

    /**
     * filter eras based on activity if the user doesn't want to see inactive eras
     * using useMemo to avoid reCalc on every render
     */
    const filteredEras = useMemo(() => {
        if (!validator || showInactiveEras) return historicalEras;

        // oly show eras where validator earned points or rewards
        return historicalEras.filter(era =>
            validator.performance.previousErasPoints[era] > 0 ||
            validator.rewards.previousErasRewards[era] > 0n
        );
    }, [validator, historicalEras, showInactiveEras]);

    /**
     * calculate average points across displayed eras
     * this helps show the validators typical performance and the user can evaluate if its consistent
     * again using useMemo to avoid reCalc
     */
    const historicalAverage = useMemo(() => {
        if (!validator) return 0;

        const points = Object.entries(validator.performance.previousErasPoints)
            .filter(([_, points]) => showInactiveEras || points > 0)
            .map(([_, points]) => points);

        if (points.length === 0) return 0;
        return points.reduce((acc, points) => acc + (points || 0), 0) / points.length;
    }, [validator, showInactiveEras]);

    /**
     * countingg the eras where the validator produced blocks (had points)
     * pretty good indicator for reliability of the val
     */
    const activePointsEras = useMemo(() => {
        if (!validator) return 0;
        return Object.values(validator.performance.previousErasPoints).filter(points => points > 0).length;
    }, [validator]);

    /**
     * counting the eras where we have APY data
     * can be fewer than active eras if still calculating
     */
    const activeAPYEras = useMemo(() => {
        if (!validator) return 0;
        return Object.values(validator.rewards.apyByEra).filter(apy => apy > 0).length;
    }, [validator]);

    /**
     * erwas where we have commission data
     */
    const activeCommissionEras = useMemo(() => {
        if (!validator) return 0;
        return Object.keys(validator.historicalCommission).length;
    }, [validator]);

    /**
     * if there is inactive eras, show the toggle
     * user can then choose to show or hide them
     */
    const hasInactiveEras = useMemo(() => {
        return validator && activePointsEras < historicalEras.length;
    }, [validator, activePointsEras, historicalEras]);

    /**
     * format APY with color coding based on performance
     */
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

    /**
     * format commission rate as a percntage
     */
    const formatCommission = (commission: number) => {
        return (commission * 100).toFixed(2) + '%';
    };

    /**
     * handle validator selection changes
     */
    const handleValidatorChange = (address: string) => {
        setSelectedHistoricalValidator(address || null);
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-xl font-bold mb-2">Historical Performance</h2>
            <p className="text-sm mb-4 text-gray-600">
                View historical era points, rewards, commission, and estimated APY for validators
            </p>

            <div className="mb-6">
                {validator && (
                    <>
                        {/* show era range */}
                        <div className="text-sm text-gray-500 italic">
                            Showing data from {historicalEras.length > 0 ? historicalEras[historicalEras.length - 1] : '–'} to {historicalEras.length > 0 ? historicalEras[0] : '–'}
                            (latest {historicalEras.length} eras)
                        </div>

                        {/* control how many eras to shwow */}
                        <div className="mt-4 flex items-center">
                            <label className="text-sm font-medium mr-3">Historical eras:</label>
                            <div className="flex items-center">
                                {/* decrease by 5 */}
                                <button
                                    className="px-2 py-1 bg-gray-100 rounded-l border border-gray-300 disabled:opacity-50"
                                    onClick={() => setHistoryLength(Math.max(1, historyLength - 5))}
                                    disabled={historyLength <= 1 || loadingHistoricalData}
                                >
                                    -5
                                </button>
                                {/* decrease by 1*/}
                                <button
                                    className="px-2 py-1 bg-gray-100 border-t border-b border-gray-300 disabled:opacity-50"
                                    onClick={() => setHistoryLength(Math.max(1, historyLength - 1))}
                                    disabled={historyLength <= 1 || loadingHistoricalData}
                                >
                                    -
                                </button>
                                {/* direct input for number of how many eras u wanna see */}
                                <input
                                    type="number"
                                    min="1"
                                    max={maxHistoryLength}
                                    value={historyLength}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        if (!isNaN(val) && val >= 1 && val <= maxHistoryLength) {
                                            setHistoryLength(val);
                                        }
                                    }}
                                    className="w-16 px-2 py-1 text-center border-t border-b border-gray-300"
                                    disabled={loadingHistoricalData}
                                />
                                {/* incr by 1 */}
                                <button
                                    className="px-2 py-1 bg-gray-100 border-t border-b border-gray-300 disabled:opacity-50"
                                    onClick={() => setHistoryLength(Math.min(maxHistoryLength, historyLength + 1))}
                                    disabled={historyLength >= maxHistoryLength || loadingHistoricalData}
                                >
                                    +
                                </button>
                                {/* incr by 5 */}
                                <button
                                    className="px-2 py-1 bg-gray-100 rounded-r border border-gray-300 disabled:opacity-50"
                                    onClick={() => setHistoryLength(Math.min(maxHistoryLength, historyLength + 5))}
                                    disabled={historyLength >= maxHistoryLength || loadingHistoricalData}
                                >
                                    +5
                                </button>
                            </div>
                            <span className="text-xs text-gray-500 ml-2">
                                (max: {maxHistoryLength})
                            </span>
                        </div>
                    </>
                )}

                {/* loading indicator for hist data */}
                {loadingHistoricalData && (
                    <div className="mt-2 flex items-center text-sm text-blue-600">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500 mr-2"></div>
                        <span>Loading historical data...</span>
                    </div>
                )}
            </div>

            <div>
                {/* select val dropdpwn */}
                <label className="block text-sm font-medium mb-1">Currently Selected Validator:</label>
                <select
                    className="w-full p-2 border rounded-md mb-4"
                    value={selectedHistoricalValidator || ''}
                    onChange={(e) => handleValidatorChange(e.target.value)}
                    disabled={loadingHistoricalData}
                >
                    <option value="">Please select validator</option>
                    {validators.map(v => (
                        <option key={v.address} value={v.address}>
                            {/* shorten addy for nicer display */}
                            {v.address.substring(0, 8)}...{v.address.substring(v.address.length - 8)}
                        </option>
                    ))}
                </select>
            </div>

            {validator && (
                <div>
                    {/* loading indicator for APY calcs */}
                    {loadingAPY && (
                        <div className="mb-4 p-2 bg-blue-50 rounded flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                            <span className="text-sm text-blue-600">Calculating APY data...</span>
                        </div>
                    )}

                    {/* show the inactive toggle only when there is inactive eras */}
                    {hasInactiveEras && (
                        <div className="mb-4">
                            <label className="inline-flex items-center text-sm cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="form-checkbox h-4 w-4 text-blue-600 mr-2"
                                    checked={showInactiveEras}
                                    onChange={() => setShowInactiveEras(!showInactiveEras)}
                                    disabled={loadingHistoricalData || !validator}
                                />
                                Show eras where validator was inactive (no points)
                            </label>
                            {!showInactiveEras && (
                                <div className="mt-1 text-xs text-gray-500">
                                    Showing {activePointsEras} active eras out of {historicalEras.length} total eras
                                </div>
                            )}
                        </div>
                    )}

                    {/* performance summary cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {/* points card */}
                        <div className="bg-gray-50 p-4 rounded">
                            <h3 className="text-sm font-medium text-gray-500">Average Points</h3>
                            <p className="text-2xl font-bold">{historicalAverage.toFixed(0)}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                Based on {showInactiveEras ? activePointsEras : activePointsEras} of {historicalEras.length} eras this validator participated in
                                {!showInactiveEras ? " (inactive eras hidden)" : ""}
                            </p>
                        </div>
                        {/* APY card */}
                        <div className="bg-gray-50 p-4 rounded">
                            <h3 className="text-sm font-medium text-gray-500">Average APY</h3>
                            <p className="text-2xl font-bold">
                                {loadingAPY ?
                                    <span className="text-gray-400">Calculating...</span> :
                                    formatAPY(showInactiveEras ? validator.rewards.averageAPY : validator.rewards.activeOnlyAverageAPY)
                                }
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                Based on {showInactiveEras ? activeAPYEras : activeAPYEras} of {historicalEras.length} eras this validator participated in
                                {!showInactiveEras ? " (inactive eras hidden)" : ""}
                            </p>
                        </div>
                        {/* commission card */}
                        <div className="bg-gray-50 p-4 rounded">
                            <h3 className="text-sm font-medium text-gray-500">Average Commission</h3>
                            <p className="text-2xl font-bold">{formatCommission(validator.averageCommission)}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                Based on {activeCommissionEras} of {historicalEras.length} eras this validator participated in
                                {!showInactiveEras ? " (inactive eras hidden)" : ""}
                            </p>
                        </div>
                    </div>

                    {/* historical era performance table */}
                    <h3 className="text-lg font-semibold mb-2">Historical Era Performance</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border p-2 text-left">Era</th>
                                    <th className="border p-2 text-right">Points</th>
                                    <th className="border p-2 text-right">Rewards</th>
                                    <th className="border p-2 text-right">Commission</th>
                                    <th className="border p-2 text-right">APY</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEras.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="border p-4 text-center text-gray-500">
                                            {!showInactiveEras
                                                ? "No active eras found for this validator in the selected period"
                                                : "No historical data available"}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredEras.map(era => (
                                        <tr key={era} className="hover:bg-gray-50">
                                            <td className="border p-2">{era}</td>
                                            <td className="border p-2 text-right">
                                                {validator.performance.previousErasPoints[era] || 0}
                                            </td>
                                            <td className="border p-2 text-right">
                                                {formatDOT(validator.rewards.previousErasRewards[era] || 0n)}
                                            </td>
                                            <td className="border p-2 text-right">
                                                {formatCommission(validator.historicalCommission[era] || validator.commission)}
                                            </td>
                                            <td className="border p-2 text-right">
                                                {loadingAPY ?
                                                    <span className="text-gray-400">Calculating...</span> :
                                                    formatAPY(validator.rewards.apyByEra[era] || 0)
                                                }
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* displayed vs total eras */}
                    {filteredEras.length > 0 && (
                        <div className="mt-4 text-sm text-gray-500 text-center">
                            {!showInactiveEras
                                ? `Showing ${filteredEras.length} active eras out of ${historicalEras.length} total eras`
                                : `Showing all ${historicalEras.length} eras. ${hasInactiveEras ? 'Use the checkbox above to hide inactive eras.' : ''}`}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};