import { describe, it, expect } from 'vitest';
import { hashJoinToken } from '../src/routes/public/join';

describe('Public join token hashing', () => {
  it('stores a one-way digest rather than the raw invitation token', async () => {
    const token = 'a'.repeat(43);
    const digest = await hashJoinToken(token);

    expect(digest).not.toBe(token);
    expect(digest.length).toBeGreaterThan(30);
  });

  it('produces the same digest for the same token', async () => {
    const token = 'Example_join_token_123456789012345678901234';
    expect(await hashJoinToken(token)).toBe(await hashJoinToken(token));
  });

  it('produces different digests for different tokens', async () => {
    expect(await hashJoinToken('token-one-123456789012345678901234567890'))
      .not.toBe(await hashJoinToken('token-two-123456789012345678901234567890'));
  });
});
