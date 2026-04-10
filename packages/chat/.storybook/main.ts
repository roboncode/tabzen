import type { StorybookConfig } from 'storybook-solidjs-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: 'storybook-solidjs-vite',
  addons: ['@storybook/addon-themes'],
  viteFinal(config) {
    return config;
  },
};

export default config;
