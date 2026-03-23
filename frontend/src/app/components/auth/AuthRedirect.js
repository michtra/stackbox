"use client"

import { useSession, signIn } from "next-auth/react";
import { useEffect } from "react";
import { CircularProgress } from "@mui/material";

export default function AuthRedirect({ children }) {
    const { data: session, status } = useSession();

    useEffect(() => {
        if (status === "unauthenticated") {
            signIn("cognito");
        }
    }, [status]);

    if (status === "loading" || status === "unauthenticated") {
        return (
            <div className="w-screen h-screen flex flex-col justify-center items-center gap-4">
                <CircularProgress size="3rem" />
            </div>
        );
    }

    return children;
}