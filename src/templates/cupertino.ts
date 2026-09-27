import type { PortfolioTemplate } from './types';
import type { AchievementItem, StatItem } from '@/types/portfolio';
import { buildPortfolio, section, cta, job, work, skills, school, social, withIds } from './build';
import { cover, ogArt, paletteFor } from './art';

const THEME = 'apple';

/** Cupertino — an iOS and hardware-software engineer. Product-page clarity. */
export const cupertinoTemplate: PortfolioTemplate = {
  id: 'cupertino',
  name: 'Cupertino',
  description: 'Crisp product-page clarity: big confident type, airy spacing and spring-loaded motion. Numbers up front, details on demand.',
  audience: 'iOS, embedded & hardware-software engineers',
  themeId: THEME,
  tags: ['Light', 'Sans-serif', 'Developer', 'Product'],
  create() {
    const pal = paletteFor(THEME);
    const name = 'Daniel Okafor-Lind';
    return buildPortfolio({
      themeId: THEME,
      scheme: 'light',
      metadata: {
        title: `${name} — iOS & Wearables Engineer`,
        description: 'Daniel Okafor-Lind builds camera, health and wearable software where milliseconds, milliwatts and millimetres all matter.',
        keywords: ['iOS engineer', 'Swift', 'SwiftUI', 'wearables', 'camera software', 'Core ML', 'embedded', 'Bluetooth LE'],
        author: name,
        favicon: '◉',
        ogImage: ogArt(name, 'iOS & Wearables Engineer', pal, 'orbit'),
      },
      navigation: { style: 'bar', brand: 'Daniel Okafor-Lind' },
      footer: { text: '© Daniel Okafor-Lind. Designed in Amsterdam.' },
      sections: [
        section(
          'hero',
          {
            eyebrow: 'iOS & Wearables Engineer',
            name,
            title: 'Software you can wear.',
            description: 'I build the camera, health and sensor software inside devices people carry all day — where every millisecond, milliwatt and millimetre is accounted for.',
            layout: 'centered',
            background: 'gradient',
            parallax: true,
            ctas: [cta('See the work', '#projects'), cta('Get in touch', '#contact', 'ghost')],
          },
          { paddingY: 'xl', align: 'center', animation: { type: 'slide', duration: 800, easing: 'spring', trigger: 'load' } },
        ),
        section(
          'stats',
          {
            heading: '',
            items: withIds<StatItem>('st', [
              { value: '11', suffix: '', label: 'Years shipping iOS' },
              { value: '38', suffix: 'M', label: 'Devices running my code' },
              { value: '4', suffix: '', label: 'Granted patents' },
            ]),
          },
          { background: 'surface', align: 'center', animation: { type: 'slide', duration: 800, easing: 'spring' } },
        ),
        section(
          'projects',
          {
            heading: 'Work',
            intro: 'Hardware ships once. The software has to be right the first time — and keep getting better after.',
            layout: 'featured',
            items: [
              work({
                title: 'Halo Ring sleep tracking',
                description: 'On-device sleep staging for a 4-gram smart ring. A Core ML model distilled to 180 KB runs overnight on 2% of the battery and matches lab polysomnography 87% of the time.',
                image: cover('cupe-halo', pal, 'orbit', 'Concentric rings with orbiting dots, suggesting a ring sensor and sleep cycles'),
                role: 'Lead iOS & firmware integration',
                duration: '2022 — 2024',
                technologies: ['Swift', 'Core ML', 'Bluetooth LE', 'HealthKit'],
                live: 'https://halo-ring.com',
                features: ['Nightly sync in under 4 seconds', 'Zero-cloud processing by default', 'Accessible sleep summaries with VoiceOver'],
                featured: true,
              }),
              work({
                title: 'Lumo Camera night mode',
                description: 'A multi-frame capture pipeline that aligns and merges nine exposures in 700 ms. Became the most-praised feature in the app’s 4.8-star reviews.',
                image: cover('cupe-lumo', pal, 'mesh', 'Soft blue and orange light blending across a pale field, like a long exposure'),
                role: 'Senior iOS engineer',
                duration: '2019 — 2021',
                technologies: ['AVFoundation', 'Metal', 'Accelerate'],
              }),
              work({
                title: 'Stride coaching for watch',
                description: 'Real-time running form feedback from wrist accelerometer data, delivered as gentle haptics instead of distracting screens.',
                image: cover('cupe-stride', pal, 'waves', 'Layered blue waveforms, representing accelerometer signals'),
                role: 'watchOS engineer',
                duration: '2021',
                technologies: ['watchOS', 'Core Motion', 'SwiftUI'],
              }),
            ],
          },
          { animation: { type: 'slide', duration: 800, easing: 'spring' } },
        ),
        section(
          'about',
          {
            heading: 'About',
            body: 'I grew up taking apart radios in Utrecht and never really stopped. After a degree in embedded systems I joined a camera startup as its third engineer, and have spent the decade since at the seam between hardware and the apps people touch.\n\nMy favourite bugs live where physics meets software: a Bluetooth stack that fails only in cold weather, a sensor that drifts when the battery sags. I like to fix them with measurement, not guesswork.',
            layout: 'stacked',
            highlights: ['Battery budgets before feature lists', 'Privacy by default: on-device first', 'Instruments open, always'],
          },
          { width: 'narrow', animation: { type: 'slide', duration: 800, easing: 'spring' } },
        ),
        section(
          'skills',
          {
            heading: 'Skills',
            intro: 'Bars show years of hands-on use, relative to my most-used tool.',
            display: 'bars',
            items: [
              ...skills('Apple platforms', [['Swift', 9, 5], ['SwiftUI', 5, 5], ['UIKit', 11, 5], ['watchOS', 5, 4]]),
              ...skills('Media & ML', [['AVFoundation', 7, 5], ['Metal', 4, 4], ['Core ML', 4, 4]]),
              ...skills('Hardware', [['Bluetooth LE', 6, 5], ['Embedded C', 8, 4], ['Power profiling', 6, 4]]),
            ],
          },
          { background: 'surface', animation: { type: 'slide', duration: 800, easing: 'spring' } },
        ),
        section(
          'experience',
          {
            heading: 'Experience',
            intro: '',
            style: 'timeline',
            items: [
              job({
                company: 'Halo Health',
                role: 'Staff iOS Engineer',
                location: 'Amsterdam',
                start: '2021-09',
                current: true,
                description: 'Leading the iOS and on-device ML team for the Halo Ring.',
                achievements: ['Cut sync time from 40 s to under 4 s', 'Shipped on-device sleep staging with zero cloud dependency'],
                technologies: ['Swift', 'Core ML', 'Bluetooth LE'],
              }),
              job({
                company: 'Lumo',
                role: 'Senior iOS Engineer',
                location: 'Berlin',
                start: '2017-03',
                end: '2021-08',
                description: 'Camera pipeline and computational photography for a top-50 photo app.',
                achievements: ['Built night mode and portrait relighting', 'Reduced capture-to-preview latency by 60%'],
                technologies: ['AVFoundation', 'Metal', 'Objective-C'],
              }),
              job({
                company: 'Pixelwerk',
                role: 'iOS Engineer',
                location: 'Utrecht',
                start: '2014-02',
                end: '2017-02',
                description: 'Third engineer at a connected-camera startup; wrote the first companion app and its firmware updater.',
                technologies: ['Objective-C', 'Embedded C'],
              }),
            ],
          },
          { animation: { type: 'slide', duration: 800, easing: 'spring' } },
        ),
        section(
          'education',
          {
            heading: 'Education',
            items: [school({ institution: 'Delft University of Technology', degree: 'MSc', field: 'Embedded Systems', location: 'Delft', start: '2011-09', end: '2013-12', grade: 'Cum laude', description: 'Thesis on low-power sensor fusion for wrist-worn devices.' })],
          },
          { width: 'narrow', animation: { type: 'slide', duration: 800, easing: 'spring' } },
        ),
        section(
          'achievements',
          {
            heading: 'Patents & recognition',
            items: withIds<AchievementItem>('ach', [
              { title: 'US Patent — Adaptive BLE sync scheduling', description: 'Battery-aware synchronisation for wearable health data.', date: '2023-06', url: '' },
              { title: 'US Patent — Multi-frame low-light alignment', description: 'Fast exposure alignment used in Lumo night mode.', date: '2021-02', url: '' },
              { title: 'Apple Design Award finalist', description: 'Lumo Camera, category: Visuals and Graphics.', date: '2020-06', url: '' },
              { title: 'Speaker, Swift Heroes', description: '“Milliwatts matter: profiling energy on Apple Watch.”', date: '2023-04', url: '' },
            ]),
          },
          { animation: { type: 'slide', duration: 800, easing: 'spring' } },
        ),
        section(
          'contact',
          {
            heading: 'Get in touch',
            body: 'Hardware startup, camera team or a gnarly Bluetooth bug — I am always happy to talk.',
            email: 'daniel@okaforlind.dev',
            location: 'Amsterdam, Netherlands',
            showForm: false,
          },
          { align: 'center', width: 'narrow', animation: { type: 'slide', duration: 800, easing: 'spring' } },
        ),
        section('social', {
          heading: '',
          style: 'icons',
          items: [social('GitHub', 'https://github.com/dokaforlind'), social('LinkedIn', 'https://www.linkedin.com/in/dokaforlind'), social('X', 'https://x.com/dokaforlind'), social('YouTube', 'https://www.youtube.com/@dokaforlind')],
        }, { align: 'center' }),
      ],
    });
  },
};
