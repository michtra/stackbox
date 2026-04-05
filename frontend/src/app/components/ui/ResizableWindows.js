"use client"

import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "@mui/icons-material";
import { ChevronLeft } from "@mui/icons-material";

import TopBar from "@/app/components/ui/TopBar";
import { createTheme, ThemeProvider } from "@mui/material";

export default function ResizableWindows({ children, isDarkMode = false }) {
    const [sideBarWidth, setSideBarWidth] = useState(700);
    const [isSideBarOpen, setIsSideBarOpen] = useState(true);
    const isResizing = useRef(false);

    useEffect(() => {
        window.addEventListener("load", () => {
            setSideBarWidth(window.innerWidth / 2);
        });
        window.addEventListener("mousemove", (e) => {
            if (!isResizing.current) {
                return;
            }
            setSideBarWidth((sideBarWidth) => {
                const newSideBarWidth = sideBarWidth - (e.movementX / 2);
                return newSideBarWidth < 500 ? sideBarWidth : newSideBarWidth
            });
        });
        window.addEventListener("mouseup", () => {
            isResizing.current = false;
        });
    }, []);

    const theme = useMemo(() => 
        createTheme({
            palette: {
                mode: isDarkMode ? "dark" : "light",
                DataGrid: {
                    bg: isDarkMode ? "#0f172b" : "#ffffff",
                },
                background: {
                    paper: isDarkMode ? "#1d293d" : "#ffffff"
                }
            },
        }),
    [isDarkMode]);

    return (
        <ThemeProvider theme={theme}>
            <div className="relative w-full h-screen flex flex-row overflow-hidden">
                <TopBar className={clsx("absolute left-0 top-0 transition-all", isSideBarOpen ? "w-full" : "w-[calc(100vw-3.5rem)]")} />
                <div className={clsx("relative flex flex-col justify-center items-center overflow-hidden transition-all", isSideBarOpen ? "w-full" : "min-w-screen")}>
                    {children[0]}
                    <div
                        className="absolute left-0 top-0 bg-linear-to-b from-black/30 via-black/20 to-transparent w-full h-20"
                    />
                </div>
                <div
                    className="flex flex-col justify-center items-center min-w-2 h-full py-2 cursor-col-resize group z-10"
                    onMouseDown={() => {
                        isResizing.current = true;
                    }}
                >
                    <div className={clsx("w-0.5 h-full bg-slate-300 dark:bg-slate-700 rounded-full transition-all group-hover:bg-slate-500")}></div>
                </div>
                <div className={clsx("flex flex-col z-10", isResizing && "select-none")} style={{ minWidth: `${sideBarWidth}px`, maxWidth: `${sideBarWidth}px` }}>
                    <div
                        className="w-14 h-14 flex flex-col px-8 pt-4 justify-center items-center text-black/40 dark:text-white/50"
                        onClick={() => {
                            setIsSideBarOpen(false);
                        }}
                    >
                        <ChevronRight sx={{ fontSize: 36 }} />
                    </div>
                    <div className="min-h-[calc(100vh-3.5rem)] max-h-[calc(100vh-3.5rem)] overflow-hidden">
                        {children[1]}
                    </div>
                </div>
                <div
                    className={clsx(isSideBarOpen && "hidden", "absolute right-4 top-4 w-10 h-10 flex flex-col justify-center items-center shadow-2xl rounded-md bg-white dark:bg-slate-900 text-black/40 dark:text-white/50 transition-all z-10")}
                    onClick={() => {
                        setIsSideBarOpen(true);
                    }}
                >
                    <ChevronLeft sx={{ fontSize: 36 }} />
                </div>
            </div>
        </ThemeProvider>
    );
}