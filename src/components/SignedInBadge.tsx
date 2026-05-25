import { User } from 'firebase/auth';

type SignedInBadgeProps = {
    user: User | null;
};

const SignedInBadge = ({ user }: SignedInBadgeProps) => {
    if (!user) return null;

    const label = user.displayName || user.email || 'TuneTeaser account';

    return <span className="account-badge">Signed in as {label}</span>;
};

export default SignedInBadge;
