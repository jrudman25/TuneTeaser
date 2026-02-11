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
            name: string;
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
        { track: { id: 'gh1', name: 'As It Was', artists: [{ name: 'Harry Styles' }], album: { name: 'Harry\'s House', images: [] } } },
        { track: { id: 'gh2', name: 'Anti-Hero', artists: [{ name: 'Taylor Swift' }], album: { name: 'Midnights', images: [] } } },
        { track: { id: 'gh3', name: 'Flowers', artists: [{ name: 'Miley Cyrus' }], album: { name: 'Endless Summer Vacation', images: [] } } },
        { track: { id: 'gh4', name: 'Kill Bill', artists: [{ name: 'SZA' }], album: { name: 'SOS', images: [] } } },
        { track: { id: 'gh5', name: 'Creepin\'', artists: [{ name: 'Metro Boomin, The Weeknd, 21 Savage' }], album: { name: 'HEROES & VILLAINS', images: [] } } },
        { track: { id: 'gh6', name: 'Cruel Summer', artists: [{ name: 'Taylor Swift' }], album: { name: 'Lover', images: [] } } },
        { track: { id: 'gh7', name: 'Vampire', artists: [{ name: 'Olivia Rodrigo' }], album: { name: 'GUTS', images: [] } } },
        { track: { id: 'gh8', name: 'Calm Down', artists: [{ name: 'Rema & Selena Gomez' }], album: { name: 'Rave & Roses Ultra', images: [] } } },
        { track: { id: 'gh9', name: 'Last Night', artists: [{ name: 'Morgan Wallen' }], album: { name: 'One Thing At A Time', images: [] } } },
        { track: { id: 'gh10', name: 'Dance The Night', artists: [{ name: 'Dua Lipa' }], album: { name: 'Barbie The Album', images: [] } } },
        { track: { id: 'gh11', name: 'Seven (feat. Latto)', artists: [{ name: 'Jung Kook' }], album: { name: 'GOLDEN', images: [] } } },
        { track: { id: 'gh12', name: 'vampire', artists: [{ name: 'Olivia Rodrigo' }], album: { name: 'GUTS', images: [] } } },
        { track: { id: 'gh13', name: 'Paint The Town Red', artists: [{ name: 'Doja Cat' }], album: { name: 'Scarlet', images: [] } } },
        { track: { id: 'gh14', name: 'Sprinter', artists: [{ name: 'Dave & Central Cee' }], album: { name: 'Split Decision', images: [] } } },
        { track: { id: 'gh15', name: 'Fast Car', artists: [{ name: 'Luke Combs' }], album: { name: 'Gettin\' Old', images: [] } } },
        { track: { id: 'gh16', name: 'Daylight', artists: [{ name: 'David Kushner' }], album: { name: 'Daylight', images: [] } } },
        { track: { id: 'gh17', name: 'Ella Baila Sola', artists: [{ name: 'Eslabon Armado X Peso Pluma' }], album: { name: 'DESVELADO', images: [] } } },
        { track: { id: 'gh18', name: 'fukumean', artists: [{ name: 'Gunna' }], album: { name: 'a Gift & a Curse', images: [] } } },
        { track: { id: 'gh19', name: 'Cupid - Twin Ver.', artists: [{ name: 'FIFTY FIFTY' }], album: { name: 'The Beginning: Cupid', images: [] } } },
        { track: { id: 'gh20', name: 'Die For You', artists: [{ name: 'The Weeknd' }], album: { name: 'Starboy', images: [] } } },
        { track: { id: 'gh21', name: 'Boy\'s a liar Pt. 2', artists: [{ name: 'PinkPantheress & Ice Spice' }], album: { name: 'Boy\'s a liar Pt. 2', images: [] } } },
        { track: { id: 'gh22', name: 'I Ain\'t Worried', artists: [{ name: 'OneRepublic' }], album: { name: 'Top Gun: Maverick (Music From The Motion Picture)', images: [] } } },
        { track: { id: 'gh23', name: 'Unholy', artists: [{ name: 'Sam Smith & Kim Petras' }], album: { name: 'Gloria', images: [] } } },
        { track: { id: 'gh24', name: 'Rich Flex', artists: [{ name: 'Drake & 21 Savage' }], album: { name: 'Her Loss', images: [] } } },
        { track: { id: 'gh25', name: 'LAVENDER HAZE', artists: [{ name: 'Taylor Swift' }], album: { name: 'Midnights', images: [] } } },
        { track: { id: 'gh26', name: 'Starboy', artists: [{ name: 'The Weeknd' }], album: { name: 'Starboy', images: [] } } },
        { track: { id: 'gh27', name: 'Mockingbird', artists: [{ name: 'Eminem' }], album: { name: 'Encore', images: [] } } },
        { track: { id: 'gh28', name: 'Blinding Lights', artists: [{ name: 'The Weeknd' }], album: { name: 'After Hours', images: [] } } },
        { track: { id: 'gh29', name: 'Stay', artists: [{ name: 'The Kid LAROI & Justin Bieber' }], album: { name: 'F*CK LOVE 3: OVER YOU', images: [] } } },
        { track: { id: 'gh30', name: 'Heat Waves', artists: [{ name: 'Glass Animals' }], album: { name: 'Dreamland', images: [] } } },
        { track: { id: 'gh31', name: 'Perfect', artists: [{ name: 'Ed Sheeran' }], album: { name: '÷ (Divide)', images: [] } } },
        { track: { id: 'gh32', name: 'Shape of You', artists: [{ name: 'Ed Sheeran' }], album: { name: '÷ (Divide)', images: [] } } },
        { track: { id: 'gh33', name: 'Believer', artists: [{ name: 'Imagine Dragons' }], album: { name: 'Evolve', images: [] } } },
        { track: { id: 'gh34', name: 'Sunflower', artists: [{ name: 'Post Malone & Swae Lee' }], album: { name: 'Spider-Man: Into the Spider-Verse', images: [] } } },
        { track: { id: 'gh35', name: 'One Dance', artists: [{ name: 'Drake' }], album: { name: 'Views', images: [] } } },
        { track: { id: 'gh36', name: 'Closer', artists: [{ name: 'The Chainsmokers' }], album: { name: 'Collage', images: [] } } },
        { track: { id: 'gh37', name: 'Someone You Loved', artists: [{ name: 'Lewis Capaldi' }], album: { name: 'Divinely Uninspired To A Hellish Extent', images: [] } } },
        { track: { id: 'gh38', name: 'Sweater Weather', artists: [{ name: 'The Neighbourhood' }], album: { name: 'I Love You.', images: [] } } },
        { track: { id: 'gh39', name: 'Another Love', artists: [{ name: 'Tom Odell' }], album: { name: 'Long Way Down', images: [] } } },
        { track: { id: 'gh40', name: 'Riptide', artists: [{ name: 'Vance Joy' }], album: { name: 'Dream Your Life Away', images: [] } } },
        { track: { id: 'gh41', name: 'Take Me To Church', artists: [{ name: 'Hozier' }], album: { name: 'Hozier', images: [] } } },
        { track: { id: 'gh42', name: 'Counting Stars', artists: [{ name: 'OneRepublic' }], album: { name: 'Native', images: [] } } },
        { track: { id: 'gh43', name: 'Can\'t Hold Us', artists: [{ name: 'Macklemore & Ryan Lewis' }], album: { name: 'The Heist', images: [] } } },
        { track: { id: 'gh44', name: 'Wake Me Up', artists: [{ name: 'Avicii' }], album: { name: 'True', images: [] } } },
        { track: { id: 'gh45', name: 'Demons', artists: [{ name: 'Imagine Dragons' }], album: { name: 'Night Visions', images: [] } } },
        { track: { id: 'gh46', name: 'Rolling in the Deep', artists: [{ name: 'Adele' }], album: { name: '21', images: [] } } },
        { track: { id: 'gh47', name: 'Viva La Vida', artists: [{ name: 'Coldplay' }], album: { name: 'Viva La Vida or Death and All His Friends', images: [] } } },
        { track: { id: 'gh48', name: 'Pompeii', artists: [{ name: 'Bastille' }], album: { name: 'Bad Blood', images: [] } } },
        { track: { id: 'gh49', name: 'Ho Hey', artists: [{ name: 'The Lumineers' }], album: { name: 'The Lumineers', images: [] } } },
        { track: { id: 'gh50', name: 'Royals', artists: [{ name: 'Lorde' }], album: { name: 'Pure Heroine', images: [] } } },
    ],
    'guest_rock_classics': [
        { track: { id: 'gr1', name: 'Bohemian Rhapsody', artists: [{ name: 'Queen' }], album: { name: 'A Night at the Opera', images: [] } } },
        { track: { id: 'gr2', name: 'Hotel California', artists: [{ name: 'Eagles' }], album: { name: 'Hotel California', images: [] } } },
        { track: { id: 'gr3', name: 'Sweet Child O\' Mine', artists: [{ name: 'Guns N\' Roses' }], album: { name: 'Appetite for Destruction', images: [] } } },
        { track: { id: 'gr4', name: 'Back In Black', artists: [{ name: 'AC/DC' }], album: { name: 'Back in Black', images: [] } } },
        { track: { id: 'gr5', name: 'Don\'t Stop Believin\'', artists: [{ name: 'Journey' }], album: { name: 'Escape', images: [] } } },
        { track: { id: 'gr6', name: 'Smells Like Teen Spirit', artists: [{ name: 'Nirvana' }], album: { name: 'Nevermind', images: [] } } },
        { track: { id: 'gr7', name: 'Sweet Home Alabama', artists: [{ name: 'Lynyrd Skynyrd' }], album: { name: 'Second Helping', images: [] } } },
        { track: { id: 'gr8', name: 'Fortunate Son', artists: [{ name: 'Creedence Clearwater Revival' }], album: { name: 'Willy and the Poor Boys', images: [] } } },
        { track: { id: 'gr9', name: 'Livin\' On A Prayer', artists: [{ name: 'Bon Jovi' }], album: { name: 'Slippery When Wet', images: [] } } },
        { track: { id: 'gr10', name: 'Dream On', artists: [{ name: 'Aerosmith' }], album: { name: 'Aerosmith', images: [] } } },
        { track: { id: 'gr11', name: 'Light My Fire', artists: [{ name: 'The Doors' }], album: { name: 'The Doors', images: [] } } },
        { track: { id: 'gr12', name: 'Paint It, Black', artists: [{ name: 'The Rolling Stones' }], album: { name: 'Aftermath', images: [] } } },
        { track: { id: 'gr13', name: 'Baba O\'Riley', artists: [{ name: 'The Who' }], album: { name: 'Who\'s Next', images: [] } } },
        { track: { id: 'gr14', name: 'Kashmir', artists: [{ name: 'Led Zeppelin' }], album: { name: 'Physical Graffiti', images: [] } } },
        { track: { id: 'gr15', name: 'Whole Lotta Love', artists: [{ name: 'Led Zeppelin' }], album: { name: 'Led Zeppelin II', images: [] } } },
        { track: { id: 'gr16', name: 'You Shook Me All Night Long', artists: [{ name: 'AC/DC' }], album: { name: 'Back in Black', images: [] } } },
        { track: { id: 'gr17', name: 'The Joker', artists: [{ name: 'Steve Miller Band' }], album: { name: 'The Joker', images: [] } } },
        { track: { id: 'gr18', name: 'Born to Run', artists: [{ name: 'Bruce Springsteen' }], album: { name: 'Born to Run', images: [] } } },
        { track: { id: 'gr19', name: 'Free Bird', artists: [{ name: 'Lynyrd Skynyrd' }], album: { name: '(Pronounced \'Lĕh-\'nérd \'Skin-\'nérd)', images: [] } } },
        { track: { id: 'gr20', name: 'Born to Be Wild', artists: [{ name: 'Steppenwolf' }], album: { name: 'Steppenwolf', images: [] } } },
        { track: { id: 'gr21', name: 'Dream Police', artists: [{ name: 'Cheap Trick' }], album: { name: 'Dream Police', images: [] } } },
        { track: { id: 'gr22', name: 'Gimme Shelter', artists: [{ name: 'The Rolling Stones' }], album: { name: 'Let It Bleed', images: [] } } },
        { track: { id: 'gr23', name: 'All Along the Watchtower', artists: [{ name: 'The Jimi Hendrix Experience' }], album: { name: 'Electric Ladyland', images: [] } } },
        { track: { id: 'gr24', name: 'Pride and Joy', artists: [{ name: 'Stevie Ray Vaughan' }], album: { name: 'Texas Flood', images: [] } } },
        { track: { id: 'gr25', name: 'Carry On Wayward Son', artists: [{ name: 'Kansas' }], album: { name: 'Leftoverture', images: [] } } },
        { track: { id: 'gr26', name: 'La Grange', artists: [{ name: 'ZZ Top' }], album: { name: 'Tres Hombres', images: [] } } },
        { track: { id: 'gr27', name: 'Sharp Dressed Man', artists: [{ name: 'ZZ Top' }], album: { name: 'Eliminator', images: [] } } },
        { track: { id: 'gr28', name: 'Go Your Own Way', artists: [{ name: 'Fleetwood Mac' }], album: { name: 'Rumours', images: [] } } },
        { track: { id: 'gr29', name: 'The Boys Are Back In Town', artists: [{ name: 'Thin Lizzy' }], album: { name: 'Jailbreak', images: [] } } },
        { track: { id: 'gr30', name: 'Roxanne', artists: [{ name: 'The Police' }], album: { name: 'Outlandos d\'Amour', images: [] } } },
        { track: { id: 'gr31', name: 'Purple Haze', artists: [{ name: 'The Jimi Hendrix Experience' }], album: { name: 'Are You Experienced', images: [] } } },
        { track: { id: 'gr32', name: 'Jump', artists: [{ name: 'Van Halen' }], album: { name: '1984', images: [] } } },
        { track: { id: 'gr33', name: 'Simple Man', artists: [{ name: 'Lynyrd Skynyrd' }], album: { name: '(Pronounced \'Lĕh-\'nérd \'Skin-\'nérd)', images: [] } } },
        { track: { id: 'gr34', name: 'Detroit Rock City', artists: [{ name: 'KISS' }], album: { name: 'Destroyer', images: [] } } },
        { track: { id: 'gr35', name: 'Thunder Road', artists: [{ name: 'Bruce Springsteen' }], album: { name: 'Born to Run', images: [] } } },
        { track: { id: 'gr36', name: 'Start Me Up', artists: [{ name: 'The Rolling Stones' }], album: { name: 'Tattoo You', images: [] } } },
        { track: { id: 'gr37', name: 'Life in the Fast Lane', artists: [{ name: 'Eagles' }], album: { name: 'Hotel California', images: [] } } },
        { track: { id: 'gr38', name: 'Paranoid', artists: [{ name: 'Black Sabbath' }], album: { name: 'Paranoid', images: [] } } },
        { track: { id: 'gr39', name: 'You Really Got Me', artists: [{ name: 'The Kinks' }], album: { name: 'Kinks', images: [] } } },
        { track: { id: 'gr40', name: 'We Will Rock You', artists: [{ name: 'Queen' }], album: { name: 'News of the World', images: [] } } },
        { track: { id: 'gr41', name: 'Barracuda', artists: [{ name: 'Heart' }], album: { name: 'Little Queen', images: [] } } },
        { track: { id: 'gr42', name: 'Walk This Way', artists: [{ name: 'Aerosmith' }], album: { name: 'Toys in the Attic', images: [] } } },
        { track: { id: 'gr43', name: 'Smoke on the Water', artists: [{ name: 'Deep Purple' }], album: { name: 'Machine Head', images: [] } } },
        { track: { id: 'gr44', name: 'More Than a Feeling', artists: [{ name: 'Boston' }], album: { name: 'Boston', images: [] } } },
        { track: { id: 'gr45', name: 'Highway to Hell', artists: [{ name: 'AC/DC' }], album: { name: 'Highway to Hell', images: [] } } },
        { track: { id: 'gr46', name: 'Everlong', artists: [{ name: 'Foo Fighters' }], album: { name: 'The Colour and the Shape', images: [] } } },
        { track: { id: 'gr47', name: 'Welcome to the Jungle', artists: [{ name: 'Guns N\' Roses' }], album: { name: 'Appetite for Destruction', images: [] } } },
        { track: { id: 'gr48', name: 'Another One Bites the Dust', artists: [{ name: 'Queen' }], album: { name: 'The Game', images: [] } } },
        { track: { id: 'gr49', name: 'Wanted Dead or Alive', artists: [{ name: 'Bon Jovi' }], album: { name: 'Slippery When Wet', images: [] } } },
        { track: { id: 'gr50', name: 'Take It Easy', artists: [{ name: 'Eagles' }], album: { name: 'Eagles', images: [] } } }
    ]
};
