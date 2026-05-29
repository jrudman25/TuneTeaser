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
            <button
                className="profile-trigger"
                type="button"
                aria-label="Open profile menu"
                aria-expanded={isOpen}
                aria-haspopup="menu"
                onClick={() => setIsOpen(current => !current)}
                title={displayLabel}
            >
                {user?.photoURL ? (
                    <img src={user.photoURL} alt="" />
                ) : (
                    <AccountCircleIcon aria-hidden="true" />
                )}
            </button>

            {isOpen && (
                <div className="profile-menu-panel" role="menu">
                    <div className="profile-menu-summary">
                        {statusBadge || <span className="account-badge">{displayLabel}</span>}
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
