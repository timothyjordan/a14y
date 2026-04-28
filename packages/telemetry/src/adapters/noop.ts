import type { Adapter } from './types';

export const noopAdapter: Adapter = {
  name: 'noop',
  async send() {
    // intentionally empty
  },
};
