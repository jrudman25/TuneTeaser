/**
 * FilterChipRow.tsx
 * A row of filter chips with a "More" overflow that opens a bottom sheet
 * listing every option. If the selected option is hidden behind "More", the
 * More chip shows that option's name so the active filter stays visible.
 * @version 2026.06.05
 */
import React, { useState } from 'react';
import Drawer from '@mui/material/Drawer';

interface FilterChipRowProps {
    label: string;
    options: string[];
    selected: string | null;
    onSelect: (value: string | null) => void;
    maxVisible?: number;
}

const FilterChipRow: React.FC<FilterChipRowProps> = ({ label, options, selected, onSelect, maxVisible = 4 }) => {
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const visibleOptions = options.slice(0, maxVisible);
    const hasMore = options.length > maxVisible;
    const selectedIsHidden = selected !== null && !visibleOptions.includes(selected);

    return (
        <div className="filter-chip-row">
            <span className="filter-chip-label">{label}</span>
            <button
                type="button"
                className={`filter-chip${selected === null ? ' filter-chip-selected' : ''}`}
                aria-pressed={selected === null}
                onClick={() => onSelect(null)}
            >
                All
            </button>
            {visibleOptions.map(option => (
                <button
                    key={option}
                    type="button"
                    className={`filter-chip${selected === option ? ' filter-chip-selected' : ''}`}
                    aria-pressed={selected === option}
                    onClick={() => onSelect(selected === option ? null : option)}
                >
                    {option}
                </button>
            ))}
            {hasMore && (
                <button
                    type="button"
                    className={`filter-chip${selectedIsHidden ? ' filter-chip-selected' : ''}`}
                    aria-pressed={selectedIsHidden}
                    aria-haspopup="dialog"
                    onClick={() => setIsSheetOpen(true)}
                >
                    {selectedIsHidden ? selected : 'More'}
                </button>
            )}
            {hasMore && (
                <Drawer anchor="bottom" open={isSheetOpen} onClose={() => setIsSheetOpen(false)}>
                    <div className="filter-chip-sheet" aria-label={`All ${label} options`}>
                        <span className="filter-chip-label">{label}</span>
                        <div className="filter-chip-sheet-options">
                            {options.map(option => (
                                <button
                                    key={option}
                                    type="button"
                                    className={`filter-chip${selected === option ? ' filter-chip-selected' : ''}`}
                                    aria-pressed={selected === option}
                                    onClick={() => {
                                        onSelect(option);
                                        setIsSheetOpen(false);
                                    }}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>
                </Drawer>
            )}
        </div>
    );
};

export default FilterChipRow;
