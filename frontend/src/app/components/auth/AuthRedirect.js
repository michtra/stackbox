"use client"

import { useSession, signIn } from "next-auth/react";
import { useEffect } from "react";
import { CircularProgress } from "@mui/material";

export default function AuthRedirect({ children }) {
    const { data: session } = useSession();

    useEffect(() => {
        if (session === null) {
            signIn("cognito");
        }
    }, [session]);
    
    if (session !== undefined) {
        return children;
    }
    else {
        
    }
    return (
        session === undefined ?
        <div className="w-screen h-screen flex flex-col justify-center items-center gap-4">
            <CircularProgress size="3rem" />
        </div> :
        {children}
    );
}