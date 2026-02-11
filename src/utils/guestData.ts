/**
 * guestData.ts
 * Handles data for playing as a guest.
 * @version 2026.02.10
 */
export interface GuestTrack {
    track: {
        id: string;
        name: string;
        artists: { name: string }[];
        album: {
            images: { url: string }[];
        };
    };
    is_local?: boolean;
}

export const GUEST_PLAYLISTS = [
    {
        id: 'guest_top_hits',
        name: 'Top Hits',
        images: [{ url: 'https://charts-images.scdn.co/assets/locale_en/regional/weekly/region_global_default.jpg' }],
        tracks: { total: 10 }
    },
    {
        id: 'guest_rock_classics',
        name: 'Rock Classics',
        images: [{ url: 'https://i.scdn.co/image/ab67706f00000003ae5a452a3d0edcf819129532' }],
        tracks: { total: 10 }
    }
];

export const GUEST_TRACKS: Record<string, GuestTrack[]> = {
    'guest_top_hits': [
        { track: { id: 'gh1', name: 'As It Was', artists: [{ name: 'Harry Styles' }], album: { images: [] } } },
        { track: { id: 'gh2', name: 'Anti-Hero', artists: [{ name: 'Taylor Swift' }], album: { images: [] } } },
        { track: { id: 'gh3', name: 'Flowers', artists: [{ name: 'Miley Cyrus' }], album: { images: [] } } },
        { track: { id: 'gh4', name: 'Kill Bill', artists: [{ name: 'SZA' }], album: { images: [] } } },
        { track: { id: 'gh5', name: 'Creepin\'', artists: [{ name: 'Metro Boomin, The Weeknd, 21 Savage' }], album: { images: [] } } },
        { track: { id: 'gh6', name: 'Cruel Summer', artists: [{ name: 'Taylor Swift' }], album: { images: [] } } },
        { track: { id: 'gh7', name: 'Vampire', artists: [{ name: 'Olivia Rodrigo' }], album: { images: [] } } },
        { track: { id: 'gh8', name: 'Calm Down', artists: [{ name: 'Rema & Selena Gomez' }], album: { images: [] } } },
        { track: { id: 'gh9', name: 'Last Night', artists: [{ name: 'Morgan Wallen' }], album: { images: [] } } },
        { track: { id: 'gh10', name: 'Dance The Night', artists: [{ name: 'Dua Lipa' }], album: { images: [] } } },
    ],
    'guest_rock_classics': [
        { track: { id: 'gr1', name: 'Bohemian Rhapsody', artists: [{ name: 'Queen' }], album: { images: [] } } },
        { track: { id: 'gr2', name: 'Hotel California', artists: [{ name: 'Eagles' }], album: { images: [] } } },
        { track: { id: 'gr3', name: 'Sweet Child O\' Mine', artists: [{ name: 'Guns N\' Roses' }], album: { images: [] } } },
        { track: { id: 'gr4', name: 'Livin\' On A Prayer', artists: [{ name: 'Bon Jovi' }], album: { images: [] } } },
        { track: { id: 'gr5', name: 'Back In Black', artists: [{ name: 'AC/DC' }], album: { images: [] } } },
        { track: { id: 'gr6', name: 'Don\'t Stop Believin\'', artists: [{ name: 'Journey' }], album: { images: [] } } },
        { track: { id: 'gr7', name: 'Smells Like Teen Spirit', artists: [{ name: 'Nirvana' }], album: { images: [] } } },
        { track: { id: 'gr8', name: 'Sweet Home Alabama', artists: [{ name: 'Lynyrd Skynyrd' }], album: { images: [] } } },
        { track: { id: 'gr9', name: 'Fortunate Son', artists: [{ name: 'Creedence Clearwater Revival' }], album: { images: [] } } },
        { track: { id: 'gr10', name: 'Mr. Brightside', artists: [{ name: 'The Killers' }], album: { images: [] } } },
    ]
};
