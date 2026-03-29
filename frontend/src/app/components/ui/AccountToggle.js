"use client"

import { Fragment, useEffect, useState } from "react";
import { Menu, MenuItem, Tooltip } from "@mui/material";
import { AccountCircle } from "@mui/icons-material";
import { Logout } from "@mui/icons-material";
import { signOut } from "next-auth/react";
import clsx from "clsx";

import { getUserCredentials } from "@/app/utilities/endpoints";

export default function AccountToggle({ className }) {
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
    }, [])

    return (
        <Fragment>
            <Tooltip title={userCred?.name} className={clsx(className, "z-50")}>
                <button
                    className="w-12 h-12 rounded-full bg-white"
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
            <Menu
                anchorEl={anchorEl}
                id="options-menu"
                open={open}
                onClose={handleClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                <div
                    className="px-4 py-2"
                >
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