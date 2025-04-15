import React from 'react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    isLoading?: boolean;
}

/**
 * pagination component for the large data set of vals
 * - always shows first and last page
 * - during loading bttns are disabled
 */
export const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    isLoading = false
}) => {
    // may number of pages to show at once
    const visiblePages = 5;

    /**
     * create array of page numbers to display
     * always include first page, last page, current page, and pages around current
     */
    const getPageNumbers = () => {
        // showin all pages if they are below the limit
        if (totalPages <= visiblePages) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }

        // always show first last and current
        const pages = [1, totalPages, currentPage];

        // add pgs before curr
        for (let i = Math.max(2, currentPage - 1); i < currentPage; i++) {
            pages.push(i);
        }

        // add pgs after curr
        for (let i = currentPage + 1; i <= Math.min(totalPages - 1, currentPage + 1); i++) {
            pages.push(i);
        }

        // remove dups and sort
        return [...new Set(pages)].sort((a, b) => a - b);
    };

    const pageNumbers = getPageNumbers();

    /**
     * render page numbers with bullets
     * add bullets if there are gaps
     */
    const renderPageNumbers = () => {
        const result: React.ReactElement[] = [];

        for (let i = 0; i < pageNumbers.length; i++) {
            const page = pageNumbers[i];

            // add bullet if gap
            if (i > 0 && pageNumbers[i] - pageNumbers[i - 1] > 1) {
                result.push(<span key={`ellipsis-${i}`} className="px-3 py-1">...</span>);
            }

            const isActive = page === currentPage;
            // styles for active and inactive buttons
            const buttonClass = `px-3 py-1 mx-1 rounded ${isActive ? 'bg-blue-500 text-white' : 'bg-white hover:bg-gray-100 text-gray-800 border'} ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`;

            result.push(
                <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    disabled={isActive || isLoading}
                    className={buttonClass}
                >
                    {page}
                </button>
            );
        }

        return result;
    };

    // if only one page no need for pagination
    if (totalPages <= 1) return null;

    const prevDisabled = currentPage === 1 || isLoading;
    const nextDisabled = currentPage === totalPages || isLoading;
    const navButtonClass = (disabled: boolean) =>
        `px-3 py-1 rounded border ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100'}`;

    return (
        <div className="flex items-center justify-center my-4 space-x-1">
            {/* prev page button */}
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={prevDisabled}
                className={navButtonClass(prevDisabled)}
            >
                Previous
            </button>

            {/* page numbers */}
            <div className="flex items-center">{renderPageNumbers()}</div>

            {/* next page button */}
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={nextDisabled}
                className={navButtonClass(nextDisabled)}
            >
                Next
            </button>
        </div>
    );
};