import { User } from 'firebase/auth';

type SignedInBadgeProps = {
    user: User | null;
};

const SignedInBadge = ({ user }: SignedInBadgeProps) => {
    if (!user) return null;

    return <span className="account-badge">Signed in with TuneTeaser</span>;
};

export default SignedInBadge;
