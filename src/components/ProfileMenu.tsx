import React from 'react';
import { Link } from 'react-router-dom';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { User } from 'firebase/auth';

interface ProfileMenuProps {
    user: User | null;
    isGuest: boolean;
    showSettings: boolean;
    statusBadge?: React.ReactNode;
    actionButtons?: React.ReactNode;
}

const ProfileMenu: React.FC<ProfileMenuProps> = ({
    user,
    isGuest,
    showSettings,
    statusBadge,
    actionButtons
}) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const menuRef = React.useRef<HTMLDivElement>(null);
    const displayLabel = isGuest ? 'Guest' : (user?.displayName || user?.email || 'Profile');
    const settingsPath = isGuest ? '/settings?mode=guest' : '/settings';

    React.useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('touchstart', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('touchstart', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    return (
        <div className="profile-menu" ref={menuRef}>
            <div
                className="profile-trigger"
                role="button"
                tabIndex={0}
                aria-label="Open profile menu"
                aria-expanded={isOpen}
                aria-haspopup="menu"
                onClick={() => setIsOpen(current => !current)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsOpen(current => !current);
                    }
                }}
                title={displayLabel}
            >
                {user?.photoURL ? (
                    <img src={user.photoURL} alt="" />
                ) : (
                    <AccountCircleIcon className="profile-icon" aria-hidden="true" />
                )}
            </div>

            {isOpen && (
                <div className="profile-menu-panel" role="menu">
                    <div className="profile-menu-summary">
                        {(isGuest || user?.displayName || user?.email) && (
                            <div className="profile-menu-identity">
                                <span className="profile-menu-username">
                                    {isGuest ? (user?.displayName || 'Guest') : (user?.displayName || user?.email?.split('@')[0])}
                                </span>
                                {!isGuest && user?.email && (
                                    <span className="profile-menu-email">{user.email}</span>
                                )}
                            </div>
                        )}
                        {statusBadge || <span className="account-badge">{isGuest ? 'Signed in as Guest' : 'Signed in with TuneTeaser'}</span>}
                    </div>

                    {showSettings && (
                        <Link
                            className="button button-secondary profile-menu-button"
                            to={settingsPath}
                            role="menuitem"
                            onClick={() => setIsOpen(false)}
                        >
                            Settings
                        </Link>
                    )}

                    {actionButtons && (
                        <div
                            className="profile-menu-actions"
                            onClick={(event) => {
                                if ((event.target as HTMLElement).closest('a,button')) {
                                    setIsOpen(false);
                                }
                            }}
                        >
                            {actionButtons}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProfileMenu;
