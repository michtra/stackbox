"use client"

import { useSession, signIn } from "next-auth/react";
import { CircularProgress } from "@mui/material";

export default function AuthRedirect({ children }) {
    const { data: session } = useSession();

    if (session === undefined) {
        return (
            <div className="w-screen h-screen flex flex-col justify-center items-center gap-4">
                <CircularProgress size="3rem" />
            </div>
        );
    }

    if (session === null) {
        signIn("cognito");
        return (
            <div className="w-screen h-screen flex flex-col justify-center items-center gap-4">
                <CircularProgress size="3rem" />
            </div>
        );
    }

    return children;
}