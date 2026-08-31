// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'CGV Game Documentation',

			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/Bohlale-Mabonga/CGV-Game',
				},
			],

			sidebar: [
				{
					label: 'Project',
					items: [
						{ label: 'Overview', slug: 'project/overview' },
						{ label: 'Requirements', slug: 'project/requirements' },
						{ label: 'Team', slug: 'project/team' },
					],
				},

				{
					label: 'Game Design',
					items: [
						{ label: 'Concept', slug: 'game-design/concept' },
						{ label: 'Gameplay', slug: 'game-design/gameplay' },
						{ label: 'Controls', slug: 'game-design/controls' },
						{ label: 'Level 1', slug: 'game-design/level-1' },
						{ label: 'Level 2', slug: 'game-design/level-2' },
						{ label: 'Level 3', slug: 'game-design/level-3' },
					],
				},

				{
					label: 'Technical Documentation',
					items: [
						{ label: 'Technology Stack', slug: 'technical/technology-stack' },
						{ label: 'Architecture', slug: 'technical/architecture' },
						{ label: 'Three.js', slug: 'technical/threejs' },
						{ label: 'Scene Design', slug: 'technical/scene-design' },
						{ label: 'Lighting', slug: 'technical/lighting' },
						{ label: 'Collision', slug: 'technical/collision' },
					],
				},

				{
					label: 'Development',
					items: [
						{ label: 'Development Process', slug: 'development/process' },
						{ label: 'Project Structure', slug: 'development/project-structure' },
						{ label: 'Git & GitHub', slug: 'development/git-github' },
					],
				},

				{
					label: 'Testing',
					items: [
						{ label: 'Testing Strategy', slug: 'testing/strategy' },
						{ label: 'Test Cases', slug: 'testing/test-cases' },
						{ label: 'Bug Tracker', slug: 'testing/bug-tracker' },
					],
				},

				{
					label: 'Deployment',
					items: [
						{ label: 'Production Build', slug: 'deployment/build' },
						{ label: 'LAMP Server', slug: 'deployment/lamp-server' },
						{ label: 'Moodle Submission', slug: 'deployment/moodle' },
					],
				},

				{
					label: 'Project Management',
					items: [
						{ label: 'Methodology', slug: 'management/methodology' },
						{ label: 'Timeline', slug: 'management/timeline' },
						{ label: 'Contributions', slug: 'management/contributions' },
					],
				},
			],
		}),
	],
});