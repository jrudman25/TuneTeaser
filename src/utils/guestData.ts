/**
 * guestData.ts
 * Handles data for playing as a guest.
 * @version 2026.02.11
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
        tracks: { total: 50 }
    },
    {
        id: 'guest_rock_classics',
        name: 'Rock Classics',
        images: [{ url: 'https://i.scdn.co/image/ab67706f00000003ae5a452a3d0edcf819129532' }],
        tracks: { total: 50 }
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
        { track: { id: 'gh11', name: 'Seven (feat. Latto)', artists: [{ name: 'Jung Kook' }], album: { images: [] } } },
        { track: { id: 'gh12', name: 'vampire', artists: [{ name: 'Olivia Rodrigo' }], album: { images: [] } } },
        { track: { id: 'gh13', name: 'Paint The Town Red', artists: [{ name: 'Doja Cat' }], album: { images: [] } } },
        { track: { id: 'gh14', name: 'Sprinter', artists: [{ name: 'Dave & Central Cee' }], album: { images: [] } } },
        { track: { id: 'gh15', name: 'Fast Car', artists: [{ name: 'Luke Combs' }], album: { images: [] } } },
        { track: { id: 'gh16', name: 'Daylight', artists: [{ name: 'David Kushner' }], album: { images: [] } } },
        { track: { id: 'gh17', name: 'Ella Baila Sola', artists: [{ name: 'Eslabon Armado X Peso Pluma' }], album: { images: [] } } },
        { track: { id: 'gh18', name: 'fukumean', artists: [{ name: 'Gunna' }], album: { images: [] } } },
        { track: { id: 'gh19', name: 'Cupid - Twin Ver.', artists: [{ name: 'FIFTY FIFTY' }], album: { images: [] } } },
        { track: { id: 'gh20', name: 'Die For You', artists: [{ name: 'The Weeknd' }], album: { images: [] } } },
        { track: { id: 'gh21', name: 'Boy\'s a liar Pt. 2', artists: [{ name: 'PinkPantheress & Ice Spice' }], album: { images: [] } } },
        { track: { id: 'gh22', name: 'I Ain\'t Worried', artists: [{ name: 'OneRepublic' }], album: { images: [] } } },
        { track: { id: 'gh23', name: 'Unholy', artists: [{ name: 'Sam Smith & Kim Petras' }], album: { images: [] } } },
        { track: { id: 'gh24', name: 'Rich Flex', artists: [{ name: 'Drake & 21 Savage' }], album: { images: [] } } },
        { track: { id: 'gh25', name: 'LAVENDER HAZE', artists: [{ name: 'Taylor Swift' }], album: { images: [] } } },
        { track: { id: 'gh26', name: 'Starboy', artists: [{ name: 'The Weeknd' }], album: { images: [] } } },
        { track: { id: 'gh27', name: 'Mockingbird', artists: [{ name: 'Eminem' }], album: { images: [] } } },
        { track: { id: 'gh28', name: 'Blinding Lights', artists: [{ name: 'The Weeknd' }], album: { images: [] } } },
        { track: { id: 'gh29', name: 'Stay', artists: [{ name: 'The Kid LAROI & Justin Bieber' }], album: { images: [] } } },
        { track: { id: 'gh30', name: 'Heat Waves', artists: [{ name: 'Glass Animals' }], album: { images: [] } } },
        { track: { id: 'gh31', name: 'Perfect', artists: [{ name: 'Ed Sheeran' }], album: { images: [] } } },
        { track: { id: 'gh32', name: 'Shape of You', artists: [{ name: 'Ed Sheeran' }], album: { images: [] } } },
        { track: { id: 'gh33', name: 'Believer', artists: [{ name: 'Imagine Dragons' }], album: { images: [] } } },
        { track: { id: 'gh34', name: 'Sunflower', artists: [{ name: 'Post Malone & Swae Lee' }], album: { images: [] } } },
        { track: { id: 'gh35', name: 'One Dance', artists: [{ name: 'Drake' }], album: { images: [] } } },
        { track: { id: 'gh36', name: 'Closer', artists: [{ name: 'The Chainsmokers' }], album: { images: [] } } },
        { track: { id: 'gh37', name: 'Someone You Loved', artists: [{ name: 'Lewis Capaldi' }], album: { images: [] } } },
        { track: { id: 'gh38', name: 'Sweater Weather', artists: [{ name: 'The Neighbourhood' }], album: { images: [] } } },
        { track: { id: 'gh39', name: 'Another Love', artists: [{ name: 'Tom Odell' }], album: { images: [] } } },
        { track: { id: 'gh40', name: 'Riptide', artists: [{ name: 'Vance Joy' }], album: { images: [] } } },
        { track: { id: 'gh41', name: 'Take Me To Church', artists: [{ name: 'Hozier' }], album: { images: [] } } },
        { track: { id: 'gh42', name: 'Counting Stars', artists: [{ name: 'OneRepublic' }], album: { images: [] } } },
        { track: { id: 'gh43', name: 'Can\'t Hold Us', artists: [{ name: 'Macklemore & Ryan Lewis' }], album: { images: [] } } },
        { track: { id: 'gh44', name: 'Wake Me Up', artists: [{ name: 'Avicii' }], album: { images: [] } } },
        { track: { id: 'gh45', name: 'Demons', artists: [{ name: 'Imagine Dragons' }], album: { images: [] } } },
        { track: { id: 'gh46', name: 'Rolling in the Deep', artists: [{ name: 'Adele' }], album: { images: [] } } },
        { track: { id: 'gh47', name: 'Viva La Vida', artists: [{ name: 'Coldplay' }], album: { images: [] } } },
        { track: { id: 'gh48', name: 'Pompeii', artists: [{ name: 'Bastille' }], album: { images: [] } } },
        { track: { id: 'gh49', name: 'Ho Hey', artists: [{ name: 'The Lumineers' }], album: { images: [] } } },
        { track: { id: 'gh50', name: 'Royals', artists: [{ name: 'Lorde' }], album: { images: [] } } },
    ],
    'guest_rock_classics': [
        { track: { id: 'gr1', name: 'Bohemian Rhapsody', artists: [{ name: 'Queen' }], album: { images: [] } } },
        { track: { id: 'gr2', name: 'Hotel California', artists: [{ name: 'Eagles' }], album: { images: [] } } },
        { track: { id: 'gr3', name: 'Sweet Child O\' Mine', artists: [{ name: 'Guns N\' Roses' }], album: { images: [] } } },
        { track: { id: 'gr4', name: 'Back In Black', artists: [{ name: 'AC/DC' }], album: { images: [] } } },
        { track: { id: 'gr5', name: 'Don\'t Stop Believin\'', artists: [{ name: 'Journey' }], album: { images: [] } } },
        { track: { id: 'gr6', name: 'Smells Like Teen Spirit', artists: [{ name: 'Nirvana' }], album: { images: [] } } },
        { track: { id: 'gr7', name: 'Sweet Home Alabama', artists: [{ name: 'Lynyrd Skynyrd' }], album: { images: [] } } },
        { track: { id: 'gr8', name: 'Fortunate Son', artists: [{ name: 'Creedence Clearwater Revival' }], album: { images: [] } } },
        { track: { id: 'gr9', name: 'Livin\' On A Prayer', artists: [{ name: 'Bon Jovi' }], album: { images: [] } } },
        { track: { id: 'gr10', name: 'Dream On', artists: [{ name: 'Aerosmith' }], album: { images: [] } } },
        { track: { id: 'gr11', name: 'Light My Fire', artists: [{ name: 'The Doors' }], album: { images: [] } } },
        { track: { id: 'gr12', name: 'Paint It, Black', artists: [{ name: 'The Rolling Stones' }], album: { images: [] } } },
        { track: { id: 'gr13', name: 'Baba O\'Riley', artists: [{ name: 'The Who' }], album: { images: [] } } },
        { track: { id: 'gr14', name: 'Kashmir', artists: [{ name: 'Led Zeppelin' }], album: { images: [] } } },
        { track: { id: 'gr15', name: 'Whole Lotta Love', artists: [{ name: 'Led Zeppelin' }], album: { images: [] } } },
        { track: { id: 'gr16', name: 'You Shook Me All Night Long', artists: [{ name: 'AC/DC' }], album: { images: [] } } },
        { track: { id: 'gr17', name: 'The Joker', artists: [{ name: 'Steve Miller Band' }], album: { images: [] } } },
        { track: { id: 'gr18', name: 'Born to Run', artists: [{ name: 'Bruce Springsteen' }], album: { images: [] } } },
        { track: { id: 'gr19', name: 'Free Bird', artists: [{ name: 'Lynyrd Skynyrd' }], album: { images: [] } } },
        { track: { id: 'gr20', name: 'Born to Be Wild', artists: [{ name: 'Steppenwolf' }], album: { images: [] } } },
        { track: { id: 'gr21', name: 'Dream Police', artists: [{ name: 'Cheap Trick' }], album: { images: [] } } },
        { track: { id: 'gr22', name: 'Gimme Shelter', artists: [{ name: 'The Rolling Stones' }], album: { images: [] } } },
        { track: { id: 'gr23', name: 'All Along the Watchtower', artists: [{ name: 'The Jimi Hendrix Experience' }], album: { images: [] } } },
        { track: { id: 'gr24', name: 'Pride and Joy', artists: [{ name: 'Stevie Ray Vaughan' }], album: { images: [] } } },
        { track: { id: 'gr25', name: 'Carry On Wayward Son', artists: [{ name: 'Kansas' }], album: { images: [] } } },
        { track: { id: 'gr26', name: 'La Grange', artists: [{ name: 'ZZ Top' }], album: { images: [] } } },
        { track: { id: 'gr27', name: 'Sharp Dressed Man', artists: [{ name: 'ZZ Top' }], album: { images: [] } } },
        { track: { id: 'gr28', name: 'Go Your Own Way', artists: [{ name: 'Fleetwood Mac' }], album: { images: [] } } },
        { track: { id: 'gr29', name: 'The Boys Are Back In Town', artists: [{ name: 'Thin Lizzy' }], album: { images: [] } } },
        { track: { id: 'gr30', name: 'Roxanne', artists: [{ name: 'The Police' }], album: { images: [] } } },
        { track: { id: 'gr31', name: 'Purple Haze', artists: [{ name: 'The Jimi Hendrix Experience' }], album: { images: [] } } },
        { track: { id: 'gr32', name: 'Jump', artists: [{ name: 'Van Halen' }], album: { images: [] } } },
        { track: { id: 'gr33', name: 'Simple Man', artists: [{ name: 'Lynyrd Skynyrd' }], album: { images: [] } } },
        { track: { id: 'gr34', name: 'Detroit Rock City', artists: [{ name: 'KISS' }], album: { images: [] } } },
        { track: { id: 'gr35', name: 'Thunder Road', artists: [{ name: 'Bruce Springsteen' }], album: { images: [] } } },
        { track: { id: 'gr36', name: 'Start Me Up', artists: [{ name: 'The Rolling Stones' }], album: { images: [] } } },
        { track: { id: 'gr37', name: 'Life in the Fast Lane', artists: [{ name: 'Eagles' }], album: { images: [] } } },
        { track: { id: 'gr38', name: 'Paranoid', artists: [{ name: 'Black Sabbath' }], album: { images: [] } } },
        { track: { id: 'gr39', name: 'You Really Got Me', artists: [{ name: 'The Kinks' }], album: { images: [] } } },
        { track: { id: 'gr40', name: 'We Will Rock You', artists: [{ name: 'Queen' }], album: { images: [] } } },
        { track: { id: 'gr41', name: 'Barracuda', artists: [{ name: 'Heart' }], album: { images: [] } } },
        { track: { id: 'gr42', name: 'Walk This Way', artists: [{ name: 'Aerosmith' }], album: { images: [] } } },
        { track: { id: 'gr43', name: 'Smoke on the Water', artists: [{ name: 'Deep Purple' }], album: { images: [] } } },
        { track: { id: 'gr44', name: 'More Than a Feeling', artists: [{ name: 'Boston' }], album: { images: [] } } },
        { track: { id: 'gr45', name: 'Highway to Hell', artists: [{ name: 'AC/DC' }], album: { images: [] } } },
        { track: { id: 'gr46', name: 'Everlong', artists: [{ name: 'Foo Fighters' }], album: { images: [] } } },
        { track: { id: 'gr47', name: 'Welcome to the Jungle', artists: [{ name: 'Guns N\' Roses' }], album: { images: [] } } },
        { track: { id: 'gr48', name: 'Another One Bites the Dust', artists: [{ name: 'Queen' }], album: { images: [] } } },
        { track: { id: 'gr49', name: 'Wanted Dead or Alive', artists: [{ name: 'Bon Jovi' }], album: { images: [] } } },
        { track: { id: 'gr50', name: 'Take It Easy', artists: [{ name: 'Eagles' }], album: { images: [] } } }
    ]
};
