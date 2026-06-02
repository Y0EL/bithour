import { UserRole } from '@prisma/client';
import 'next-auth';

declare module 'next-auth' {
    interface Session {
        user: {
            id: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
            role: UserRole;
            username: string;
            fullName: string;
        };
    }

    interface User {
        id: string;
        role: UserRole;
        username: string;
        fullName: string;
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        id: string;
        role: UserRole;
        username: string;
        fullName: string;
    }
}
