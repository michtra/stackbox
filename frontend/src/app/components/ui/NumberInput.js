import clsx from "clsx";
import { useEffect, useState } from "react";

export default function NumberInput({
    value,
    onChange,
    increment,
    min = -Infinity,
    max = Infinity,
    isValid,
    isIntOnly = false,
    showIncrementButton = true,
    refreshToggle,
    isValidOverride = null,
}) {
    const [isError, setIsError] = useState(false);
    const [errorInfo, setErrorInfo] = useState("");
    const [displayValue, setDisplayValue] = useState(value);

    const setIsValid = (val) => {
        if (isValidOverride !== null) {
            isValidOverride(val);
        }
        else {
            isValid.current = val;
        }
    }

    useEffect(() => {
        setDisplayValue(value);
    }, [value]);

    useEffect(() => {
        if (value !== NaN && min <= value && value <= max) {
            setIsValid(true);
            setIsError(false);
        }
        else {
            setIsValid(false);
            setIsError(true);
            setErrorInfo(`Number must be between ${min} and ${max}.`);
        }
    }, [refreshToggle]);

    return (
        <div className="flex flex-col gap-2">
            <div className={clsx("flex flex-row max-w-84 gap-2 justify-between items-center outline rounded-sm focus-within:outline-blue-500 focus-within:outline-2", isError && "outline-red-500! outline-2")}>
                {
                    showIncrementButton &&
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
                }
                <input
                    value={displayValue}
                    type="text"
                    inputMode="numeric"
                    pattern={isIntOnly ? "[0-9]+" : "([0-9]+\.?[0-9]*)|([0-9]*\.?[0-9]+)"}
                    className={clsx("outline-0 py-2", showIncrementButton ? "px-2" : "px-4")}
                    onChange={(e) => {
                        const newValue = Number(e.target.value);
                        if (typeof onChange == "function" && newValue !== NaN) {
                            setDisplayValue(e.target.value);
                            if (min <= newValue && newValue <= max) {
                                setIsValid(true);
                                setIsError(false);
                                onChange(newValue);
                            }
                            else {
                                setIsValid(false);
                                setIsError(true);
                                setErrorInfo(`Number must be between ${min} and ${max}.`);
                            }
                        }
                        else if (typeof onChange == "function" && (!e.target.value || e.target.value == "-")) {
                            setDisplayValue(e.target.value);
                            setIsValid(false);
                            setIsError(true);
                            setErrorInfo("Field cannot be empty.")
                        }
                    }}
                />
                {
                    showIncrementButton &&
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
                }
            </div>
            {
                isError &&
                <span className="text-red-500 text-sm">{errorInfo}</span>
            }
        </div>
    );
}