import NextAuth from "next-auth";
import CognitoProvider from "next-auth/providers/cognito";

const handler = NextAuth({
    providers: [
        CognitoProvider({
            clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
            clientSecret: process.env.COGNITO_CLIENT_SECRET,
            issuer: process.env.COGNITO_ISSUER,
        }),
    ],
    callbacks: {
        async jwt({ token, account }) {
            // Persist the access token so we can forward it to the backend
            if (account?.access_token) {
                token.accessToken = account.access_token;
                token.idToken = account.id_token;
            }
            return token;
        },
        async session({ session, token }) {
            session.accessToken = token.accessToken;
            session.idToken = token.idToken;
            return session;
        },
    },
});

export { handler as GET, handler as POST };
