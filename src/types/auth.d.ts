import { UserRole } from './user-management';

declare global {
    interface CustomJwtSessionClaims {
        metadata: {
            role?: UserRole;
        };
    }
}
