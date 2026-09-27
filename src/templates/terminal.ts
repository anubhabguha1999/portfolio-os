import type { PortfolioTemplate } from './types';
import type { BlogItem, CertificationItem, StatItem } from '@/types/portfolio';
import { buildPortfolio, section, cta, job, work, skills, social, withIds } from './build';
import { cover, ogArt, paletteFor } from './art';

const THEME = 'terminal';

/** Developer Terminal — an infrastructure engineer who lives in the shell. */
export const terminalTemplate: PortfolioTemplate = {
  id: 'terminal',
  name: 'Developer Terminal',
  description: 'Phosphor green monospace on near-black, a typing prompt and a grid backdrop. For engineers who would rather show a benchmark than a headshot.',
  audience: 'Backend, infrastructure & systems engineers',
  themeId: THEME,
  tags: ['Dark', 'Monospace', 'Developer', 'Animated'],
  create() {
    const pal = paletteFor(THEME);
    const name = 'Arjun Vasudevan';
    const fade = { type: 'fade' as const, duration: 400, easing: 'linear' as const };
    return buildPortfolio({
      themeId: THEME,
      scheme: 'dark',
      metadata: {
        title: `${name} — Distributed Systems Engineer`,
        description: 'Arjun Vasudevan builds storage engines and distributed systems in Rust and Go. Staff engineer at Tidewell, maintainer of the lodestone KV store.',
        keywords: ['distributed systems', 'Rust', 'Go', 'storage engines', 'infrastructure', 'SRE', 'consensus'],
        author: name,
        favicon: '▮',
        ogImage: ogArt(name, 'Distributed Systems Engineer', pal, 'terminal'),
      },
      navigation: { style: 'bar', brand: '~/arjun' },
      footer: { text: 'exit 0 — © Arjun Vasudevan. No trackers, no cookies, just HTML.' },
      sections: [
        section(
          'hero',
          {
            eyebrow: '$ whoami',
            name,
            title: 'Staff engineer. I make databases boring.',
            description: 'Ten years building the layer everyone else forgets exists: storage engines, replication, consensus and the on-call runbooks that go with them. Currently keeping 4 PB of customer data durable at Tidewell.',
            layout: 'minimal',
            background: 'grid',
            typingEnabled: true,
            typingPhrases: ['cargo build --release', 'kubectl rollout status', 'raft: leader elected in 212ms', 'p99 latency: 3.1ms'],
            availability: 'Not looking — happy to talk shop',
            ctas: [cta('~/projects', '#projects'), cta('cat resume.txt', '#experience', 'secondary')],
          },
          { paddingY: 'xl', animation: { ...fade, trigger: 'load' } },
        ),
        section(
          'stats',
          {
            heading: '',
            items: withIds<StatItem>('st', [
              { value: '4', suffix: ' PB', label: 'Customer data under management' },
              { value: '99.995', suffix: '%', label: 'Durability SLO met, 3 years running' },
              { value: '1.8', suffix: 'k', label: 'GitHub stars on lodestone' },
              { value: '0', suffix: '', label: 'Data-loss incidents on my watch' },
            ]),
          },
          { background: 'surface', paddingY: 'sm', animation: fade },
        ),
        section(
          'skills',
          {
            heading: 'stack --verbose',
            intro: 'What I reach for, roughly ordered by how often it shows up in my shell history.',
            display: 'stack',
            items: [
              ...skills('Languages', [['Rust', 6, 5], ['Go', 8, 5], ['C', 5, 3], ['Python', 9, 4]]),
              ...skills('Systems', [['Raft / Paxos', 6, 4], ['LSM trees', 5, 5], ['io_uring', 2, 3], ['eBPF', 2, 3]]),
              ...skills('Operations', [['Kubernetes', 6, 4], ['Terraform', 5, 4], ['Prometheus', 7, 4], ['Linux perf', 7, 5]]),
            ],
          },
          { animation: fade },
        ),
        section(
          'projects',
          {
            heading: 'ls ~/projects',
            intro: 'Open source first. Links go to source, benchmarks and the post-mortems I was allowed to publish.',
            layout: 'grid',
            items: [
              work({
                title: 'lodestone',
                description: 'An embeddable, crash-safe key-value store written in Rust. LSM-based, with lock-free reads and a write path that survives `kill -9` mid-compaction.',
                image: cover('term-lodestone', pal, 'terminal', 'Stylised terminal window with coloured lines of code'),
                role: 'Creator & maintainer',
                duration: '2021 — present',
                technologies: ['Rust', 'io_uring', 'Criterion'],
                github: 'https://github.com/arjunv/lodestone',
                features: ['1.2M writes/s on a single NVMe drive', 'Deterministic simulation test suite', 'Zero unsafe blocks outside the allocator'],
                caseStudy:
                  '## Why another KV store?\n\nMost embedded stores optimise for benchmarks, not for the 3 a.m. page. lodestone optimises for **recovery**: every on-disk structure is checksummed, and the WAL replay is fuzzed nightly.\n\n## Results\n\n- Recovery after power loss in under 400 ms for a 50 GB dataset\n- Adopted as the metadata store for two internal Tidewell services\n- Found and fixed a torn-write bug in a popular filesystem along the way',
                featured: true,
              }),
              work({
                title: 'Tidewell Replicator',
                description: 'Cross-region replication for Tidewell’s object store. Replaced a batch pipeline with a streaming design that cut replication lag from 40 minutes to 9 seconds.',
                image: cover('term-replicator', pal, 'contours', 'Green topographic contour lines spreading from a centre'),
                role: 'Tech lead',
                duration: '2022 — 2023',
                technologies: ['Go', 'gRPC', 'Kafka'],
              }),
              work({
                title: 'raftscope',
                description: 'A terminal UI that visualises Raft clusters in real time — leader elections, log replication and partitions — from a packet capture.',
                image: cover('term-raftscope', pal, 'grid', 'Dark grid with a circle and square joined by a dashed line, like a network diagram'),
                role: 'Author',
                duration: 'Weekend project',
                technologies: ['Go', 'Bubble Tea', 'pcap'],
                github: 'https://github.com/arjunv/raftscope',
              }),
            ],
          },
          { animation: fade },
        ),
        section(
          'experience',
          {
            heading: 'git log --career',
            intro: '',
            style: 'timeline',
            items: [
              job({ company: 'Tidewell', role: 'Staff Software Engineer, Storage', location: 'Remote (Bengaluru)', start: '2021-02', current: true, description: 'Own the durability story for a multi-region object store.', achievements: ['Designed the erasure-coding migration that saved 31% on storage costs', 'Wrote the storage on-call handbook; median time-to-mitigate fell from 47 to 12 minutes'], technologies: ['Rust', 'Go', 'Kubernetes'] }),
              job({ company: 'Kestrel Cloud', role: 'Senior Engineer, Databases', location: 'Bengaluru', start: '2017-05', end: '2021-01', description: 'Built the managed Postgres offering from zero to 6,000 clusters.', achievements: ['Automated failover with a p50 of 14 seconds', 'Led the incident response for the 2019 region outage'], technologies: ['Go', 'PostgreSQL', 'Terraform'] }),
              job({ company: 'Numbra Analytics', role: 'Software Engineer', location: 'Pune', start: '2015-07', end: '2017-04', description: 'Query engine internals for a columnar analytics database.', technologies: ['C++', 'Python'] }),
            ],
          },
          { animation: fade },
        ),
        section(
          'certifications',
          {
            heading: 'Certificates',
            items: withIds<CertificationItem>('crt', [
              { name: 'Certified Kubernetes Administrator (CKA)', issuer: 'Cloud Native Computing Foundation', date: '2023-03', credentialId: 'LF-7Q2K4M91XZ', url: '' },
              { name: 'Professional Cloud Architect', issuer: 'Google Cloud', date: '2022-08', credentialId: 'GCP-PCA-50318', url: '' },
              { name: 'Linux Foundation Certified SysAdmin', issuer: 'The Linux Foundation', date: '2019-11', credentialId: 'LFCS-1904-2217', url: '' },
            ]),
          },
          { width: 'narrow', animation: fade },
        ),
        section(
          'blog',
          {
            heading: 'tail -n 3 ~/writing',
            intro: '',
            items: withIds<BlogItem>('blg', [
              { title: 'fsync is a promise, not a guarantee', excerpt: 'What I learned chasing a durability bug through three layers of caching and one very honest disk controller.', date: '2025-03', url: 'https://arjun.sh/posts/fsync', tags: ['Storage', 'Linux'] },
              { title: 'Deterministic simulation testing on a budget', excerpt: 'You do not need a custom hypervisor to find concurrency bugs. A seeded scheduler and patience go a long way.', date: '2024-10', url: 'https://arjun.sh/posts/simulation', tags: ['Testing', 'Rust'] },
              { title: 'The on-call handbook I wish I had', excerpt: 'Runbooks, escalation paths and the three questions to ask before touching production at night.', date: '2024-05', url: 'https://arjun.sh/posts/on-call', tags: ['SRE'] },
            ]),
          },
          { background: 'surface', animation: fade },
        ),
        section(
          'contact',
          {
            heading: 'ping arjun',
            body: 'Questions about storage internals, a talk at your meetup, or a bug in lodestone? Email is the fastest path. PGP key on my site.',
            email: 'arjun@arjun.sh',
            location: 'Bengaluru, India (UTC+5:30)',
            showForm: false,
          },
          { width: 'narrow', animation: fade },
        ),
        section('social', {
          heading: '',
          style: 'icons',
          items: [social('GitHub', 'https://github.com/arjunv'), social('LinkedIn', 'https://www.linkedin.com/in/arjunvasudevan'), social('RSS', 'https://arjun.sh/feed.xml', 'RSS feed'), social('Website', 'https://arjun.sh', 'arjun.sh')],
        }),
      ],
    });
  },
};
