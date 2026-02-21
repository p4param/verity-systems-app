import { useState, useEffect } from "react";

/**
 * useDebounce
 * 
 * A hook that delays updating a value until after a specified delay.
 * Useful for auto-save and search interactions.
 */
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}
