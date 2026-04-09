import NextAuth from "next-auth";
import CognitoProvider from "next-auth/providers/cognito";

async function refreshAccessToken(token) {
    try {
        const body = new URLSearchParams({
            client_id: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
            client_secret: process.env.COGNITO_CLIENT_SECRET,
            grant_type: "refresh_token",
            refresh_token: token.refreshToken
        });

        const response = await fetch(`${process.env.NEXT_PUBLIC_COGNITO_DOMAIN}/oauth2/token`, {
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            body: body.toString(),
        });

        const tokenData = await response.json();
        if (!response.ok) throw tokenData;

        return {
            ...token,
            accessToken: tokenData.access_token,
            idToken: tokenData.id_token,
            expiresAt: Date.now() + tokenData.expires_in * 1000,
            refreshToken: tokenData.refresh_token ?? token.refreshToken,
        };
    }
    catch (error) {
        console.error(`Error when refreshing access token: ${error}`);
        return { ...token, error: "RefreshAccessTokenError" }
    }
}

const handler = NextAuth({
    providers: [
        CognitoProvider({
            clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
            clientSecret: process.env.COGNITO_CLIENT_SECRET,
            issuer: process.env.COGNITO_ISSUER,
        }),
    ],
    callbacks: {
        async jwt({ token, account, user }) {
            // Persist the access token so we can forward it to the backend
            if (account && user) {
                token.accessToken = account.access_token;
                token.idToken = account.id_token;
                token.refreshToken = account.refresh_token;
                token.expiresAt = account.expires_at * 1000;
                token.user = user;

                return token;
            }
            
            if (Date.now() < token.expiresAt) {
                return token;
            }

            return refreshAccessToken(token);
        },
        async session({ session, token }) {
            session.user = token.user;
            session.accessToken = token.accessToken;
            session.idToken = token.idToken;
            return session;
        },
    },
});

export { handler as GET, handler as POST };
