import clsx from "clsx";
import { useEffect, useState } from "react";

export default function NumberInput({ value, onChange, increment, min, max, isValid }) {
    const [isError, setIsError] = useState(false);
    const [errorInfo, setErrorInfo] = useState("");
    const [displayValue, setDisplayValue] = useState(value);

    useEffect(() => {
        setDisplayValue(value);
    }, [value]);

    return (
        <div className="flex flex-col gap-2">
            <div className={clsx("flex flex-row w-84 gap-2 justify-between items-center outline rounded-sm focus-within:outline-blue-500 focus-within:outline-2", isError && "outline-red-500! outline-2")}>
                <button
                    className="flex flex-col justify-center items-center w-8 h-full hover:bg-blue-400/50 transition-all"
                    onClick={() => {
                        const newValue = value - increment;
                        if (typeof onChange == "function" && newValue >= min) {
                            onChange(newValue);
                        }
                    }}
                >
                    -
                </button>
                <input
                    value={displayValue}
                    type="text"
                    inputMode="numeric"
                    pattern="([0-9]+\.?[0-9]*)|([0-9]*\.?[0-9]+)"
                    className="outline-0 p-2"
                    onChange={(e) => {
                        const newValue = Number(e.target.value);
                        if (typeof onChange == "function" && newValue) {
                            setDisplayValue(e.target.value);
                            if (newValue && min <= newValue && newValue <= max) {
                                isValid.current = true;
                                setIsError(false);
                                onChange(newValue);
                            }
                            else {
                                isValid.current = false;
                                setIsError(true);
                                setErrorInfo(`Number must be between ${min} and ${max}.`);
                            }
                        }
                        else if (typeof onChange == "function" && (!e.target.value || e.target.value == "-")) {
                            setDisplayValue(e.target.value);
                            isValid.current = false;
                            setIsError(true);
                            setErrorInfo("Field cannot be empty.")
                        }
                    }}
                />
                <button
                    className="flex flex-col justify-center items-center w-8 h-full hover:bg-blue-400/50 transition-all"
                    onClick={() => {
                        const newValue = value + increment;
                        if (typeof onChange == "function" && newValue <= max) {
                            onChange(newValue);
                        }
                    }}
                >
                    +
                </button>
            </div>
            {
                isError &&
                <span className="text-red-500 text-sm">{errorInfo}</span>
            }
        </div>
    );
}