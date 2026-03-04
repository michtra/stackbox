import { useState } from "react";

export default function NumberInput({ value, onChange, increment, min, max }) {
    const [error, isError] = useState(false);

    return (
        <div className="flex flex-row w-84 p-2 gap-2 justify-between outline rounded-sm focus-within:outline-blue-500 focus-within:outline-2">
            <button
                onClick={() => {
                    if (typeof onChange == "function") {
                        onChange(value - increment);
                    }
                }}
            >
                -
            </button>
            <input
                value={value}
                type="text"
                inputMode="numeric"
                pattern="([0-9]+\.?[0-9]*)|([0-9]*\.?[0-9]+)"
                className="outline-0"
                onChange={(e) => {
                    if (typeof onChange == "function") {
                        const newValue = Number(e.target.value);
                        if (newValue) {
                            onChange(newValue);
                        }
                    }
                }}
            />
            <button
                onClick={() => {
                    if (typeof onChange == "function") {
                        onChange(value + increment);
                    }
                }}
            >
                +
            </button>
        </div>
    );
}