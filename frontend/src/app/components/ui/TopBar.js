"use client"

import { Fragment, useEffect, useState } from "react";
import { Menu, MenuItem, Tooltip } from "@mui/material";
import { AccountCircle, Logout } from "@mui/icons-material";
import { signOut } from "next-auth/react";
import clsx from "clsx";
import { useRouter } from "next/navigation";

import { getUserCredentials } from "@/app/utilities/endpoints";

export default function TopBar({ className }) {
    const router = useRouter();

    const [anchorEl, setAnchorEl] = useState();
    const [userCred, setUserCred] = useState();
    const open = Boolean(anchorEl);

    const handleClose = () => {
        setAnchorEl(null);
    }

    useEffect(() => {
        getUserCredentials().then((credentials) => {
            setUserCred(credentials);
        });
    }, []);

    return (
        <Fragment>
            <div className={clsx(className, "z-50 flex flex-row items-center justify-between gap-2 p-4 pointer-events-none")}>
                <button
                    className="pr-4 hover:cursor-pointer px-3 h-10 rounded-md pointer-events-auto"
                    onClick={() => router.push("/")}
                >
                    <span className="font-semibold text-lg text-white">Stackbox <span className="font-light">Pre-Alpha</span></span>
                </button>
                <Tooltip title={userCred?.name}>
                    <button
                        className="hover:cursor-pointer w-10 h-10 rounded-md bg-white dark:bg-slate-900 pointer-events-auto"
                        onClick={(e) => {
                            setAnchorEl(e.currentTarget);
                        }}
                        aria-controls={open ? 'options-menu' : undefined}
                        aria-haspopup="true"
                        aria-expanded={open ? 'true' : undefined}
                    >
                        <AccountCircle sx={{ fontSize: "2rem" }} />
                    </button>
                </Tooltip>
            </div>
            <Menu
                anchorEl={anchorEl}
                id="options-menu"
                open={open}
                onClose={handleClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                <div
                    className="flex flex-col px-4 py-2 gap-2"
                >
                    <span className="text-sm">Hi {userCred?.name}! 👋</span>
                    <span className="text-sm">{userCred?.email}</span>
                </div>
                <MenuItem
                    onClick={() => {
                        signOut({
                            callbackUrl: `${process.env.NEXT_PUBLIC_COGNITO_DOMAIN}/logout?client_id=${process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID}&logout_uri=${process.env.NEXT_PUBLIC_CLIENT_URL}`
                        });
                        handleClose();
                    }}
                    className="flex flex-row gap-2"
                >
                    <Logout sx={{ fontSize: "1rem" }} />
                    <span className="text-sm">Sign Out</span>
                </MenuItem>
            </Menu>
        </Fragment>
    );
}