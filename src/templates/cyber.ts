import type { PortfolioTemplate } from './types';
import type { GalleryItem, StatItem, TimelineItem } from '@/types/portfolio';
import { buildPortfolio, section, cta, work, skills, social, withIds } from './build';
import { cover, galleryArt, ogArt, paletteFor } from './art';

const THEME = 'cyberpunk';

/** Cyber — a creative technologist building interactive worlds. */
export const cyberTemplate: PortfolioTemplate = {
  id: 'cyber',
  name: 'Cyber',
  description: 'Neon magenta and cyan on violet-black, a particle-field hero and a sideways-scrolling reel of work. Loud, glowing and nocturnal.',
  audience: 'Creative technologists, game & WebGL developers',
  themeId: THEME,
  tags: ['Dark', 'Neon', 'Animated', 'Creative'],
  create() {
    const pal = paletteFor(THEME);
    const name = 'Kai Nakamura-Reyes';
    const blur = { type: 'blur' as const, duration: 600 };
    return buildPortfolio({
      themeId: THEME,
      scheme: 'dark',
      metadata: {
        title: `${name} — Creative Technologist`,
        description: 'Kai Nakamura-Reyes builds interactive installations, WebGL worlds and real-time experiences for museums, festivals and music artists.',
        keywords: ['creative technologist', 'WebGL', 'interactive installation', 'three.js', 'shaders', 'real-time graphics', 'game development'],
        author: name,
        favicon: '⚡',
        ogImage: ogArt(name, 'Creative Technologist', pal, 'mesh'),
      },
      navigation: { style: 'floating', brand: 'KAI//NR' },
      footer: { text: '© Kai Nakamura-Reyes. Rendered at 60fps, served as static HTML.' },
      sections: [
        section(
          'hero',
          {
            eyebrow: 'Creative technologist · Mexico City ⇄ Osaka',
            name,
            title: 'I build worlds you can walk into.',
            description: 'Interactive installations, real-time visuals and browser experiences that react to bodies, sound and weather. Eight years of shaders, sensors and very late load-ins.',
            layout: 'centered',
            background: 'particles',
            typingEnabled: true,
            typingPhrases: ['GLSL shaders', 'LiDAR installations', 'live-coded visuals', 'WebGPU experiments'],
            magneticButtons: true,
            ctas: [cta('Enter the reel', '#projects'), cta('Book a collaboration', '#contact', 'secondary')],
          },
          { paddingY: 'xl', animation: { ...blur, trigger: 'load' } },
        ),
        section(
          'projects',
          {
            heading: 'The reel',
            intro: 'Scroll sideways. Every piece ran in public, in real time, in front of real people.',
            layout: 'horizontal',
            items: [
              work({ title: 'Nocturne Grid', description: 'A 40-metre LED wall in Osaka that turns passing crowds into drifting particle constellations using overhead LiDAR.', image: cover('cy-nocturne', pal, 'mesh', 'Glowing magenta and cyan colour field, like neon light through fog'), role: 'Lead developer', duration: '2025 · 3 months', technologies: ['TouchDesigner', 'GLSL', 'LiDAR'], featured: true }),
              work({ title: 'Signal//Noise', description: 'Live-coded concert visuals for electronic duo Paralux, synced to stems over OSC across a 22-date European tour.', image: cover('cy-signal', pal, 'orbit', 'Neon rings with orbiting dots on violet black'), role: 'Visual director', duration: '2024 tour', technologies: ['three.js', 'WebGPU', 'OSC'] }),
              work({ title: 'Glasshouse', description: 'A browser-based greenhouse where plants grow according to the live weather in the visitor’s own city.', image: cover('cy-glasshouse', pal, 'glass', 'Frosted glass panel floating over glowing colour blobs'), role: 'Creator', duration: '2024', technologies: ['WebGL', 'Open-Meteo', 'Procedural'], live: 'https://glasshouse.kainr.studio' }),
              work({ title: 'Tidal Memory', description: 'A museum installation mapping 100 years of sea-level data onto a floor of reactive sand projection.', image: cover('cy-tidal', pal, 'contours', 'Neon contour rings like a topographic map of the sea floor'), role: 'Creative technologist', duration: '2023', technologies: ['Unity', 'Kinect', 'Projection mapping'] }),
              work({ title: 'Arcade Afterlife', description: 'A playable love letter to 90s arcades: a multiplayer racing game controlled by dancing on pressure pads.', image: cover('cy-arcade', pal, 'mesh', 'Soft neon gradient in pink, cyan and yellow'), role: 'Game developer', duration: '2022', technologies: ['Godot', 'Arduino', 'WebSockets'] }),
            ],
          },
          { width: 'full', animation: blur },
        ),
        section(
          'skills',
          {
            heading: 'Toolkit',
            intro: 'The instruments I play, orbiting the thing I care about most: presence.',
            display: 'orbit',
            items: [
              ...skills('Real-time', [['GLSL', 7, 5], ['three.js', 7, 5], ['WebGPU', 2, 3], ['TouchDesigner', 6, 5]]),
              ...skills('Engines', [['Unity', 5, 4], ['Godot', 3, 3]]),
              ...skills('Physical', [['Arduino', 6, 4], ['LiDAR & depth sensing', 4, 4], ['Projection mapping', 5, 4]]),
            ],
          },
          { background: 'gradient', animation: blur },
        ),
        section(
          'timeline',
          {
            heading: 'Signal path',
            items: withIds<TimelineItem>('tl', [
              { date: '2017', title: 'First shader, first crash', description: 'Wrote a fragment shader that melted a university lab GPU. Kept going.' },
              { date: '2018', title: 'Joined Lumen Collective', description: 'Four years building touring installations for festivals across Latin America.' },
              { date: '2020', title: 'Browser as venue', description: 'When stages closed, moved the work online — Glasshouse prototypes began here.' },
              { date: '2022', title: 'Arcade Afterlife', description: 'Premiered at a Mexico City game festival; 11,000 players in one weekend.' },
              { date: '2023', title: 'Residency in Osaka', description: 'Six-month media-art residency that became a permanent second base.' },
              { date: '2025', title: 'Studio KAI//NR', description: 'Independent studio working with museums, musicians and city festivals.' },
            ]),
          },
          { width: 'narrow', animation: blur },
        ),
        section(
          'gallery',
          {
            heading: 'Frames',
            layout: 'strip',
            items: withIds<GalleryItem>('gal', [
              { image: galleryArt('cy-g1', pal, 'mesh', 'Frame from Nocturne Grid: neon fog in magenta'), caption: 'Nocturne Grid, opening night' },
              { image: galleryArt('cy-g2', pal, 'orbit', 'Frame from Signal//Noise: rings pulsing to the beat'), caption: 'Signal//Noise, Berlin' },
              { image: galleryArt('cy-g3', pal, 'glass', 'Frame from Glasshouse: frosted panel over coloured light'), caption: 'Glasshouse, rainy Tuesday' },
              { image: galleryArt('cy-g4', pal, 'contours', 'Frame from Tidal Memory: glowing contour lines'), caption: 'Tidal Memory, sand floor' },
              { image: galleryArt('cy-g5', pal, 'grid', 'Frame from Arcade Afterlife: neon grid with a lone circle'), caption: 'Arcade Afterlife, attract mode' },
            ]),
          },
          { width: 'full', animation: blur },
        ),
        section(
          'stats',
          {
            heading: '',
            items: withIds<StatItem>('st', [
              { value: '31', suffix: '', label: 'Installations shipped' },
              { value: '1.2', suffix: 'M', label: 'Visitors in physical spaces' },
              { value: '60', suffix: 'fps', label: 'Minimum, always' },
              { value: '9', suffix: '', label: 'Countries toured' },
            ]),
          },
          { background: 'surface', paddingY: 'sm', animation: blur },
        ),
        section(
          'contact',
          {
            heading: 'Build something strange with me',
            body: 'Museums, festivals, artists and brands with an appetite for the unusual — send me the brief, the venue and the wildest version of the idea.',
            email: 'signal@kainr.studio',
            location: 'Mexico City & Osaka',
            availability: 'Booking installs for 2026',
            showForm: true,
          },
          { background: 'gradient', animation: blur },
        ),
        section('social', {
          heading: 'Transmissions',
          style: 'buttons',
          items: [social('Instagram', 'https://www.instagram.com/kai.nr.studio'), social('YouTube', 'https://www.youtube.com/@kainrstudio'), social('GitHub', 'https://github.com/kainr'), social('X', 'https://x.com/kai_nr')],
        }),
      ],
    });
  },
};
