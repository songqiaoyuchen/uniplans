import { NextRequest } from 'next/server';

import { getModuleSummaries } from '@/db/getModuleSummaries';
import { POST } from './route';

jest.mock('@/db/getModuleSummaries', () => ({
  getModuleSummaries: jest.fn(),
}));

const mockedGetModuleSummaries =
  getModuleSummaries as jest.MockedFunction<typeof getModuleSummaries>;

describe('POST /api/modules/summaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('normalizes and deduplicates module codes', async () => {
    mockedGetModuleSummaries.mockReturnValue([
      { code: 'CS1010', title: 'Programming Methodology' },
    ]);

    const request = new NextRequest(
      'https://uniplans.example/api/modules/summaries',
      {
        method: 'POST',
        body: JSON.stringify({ codes: [' cs1010 ', 'CS1010'] }),
        headers: { 'content-type': 'application/json' },
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockedGetModuleSummaries).toHaveBeenCalledWith(['CS1010']);
    await expect(response.json()).resolves.toEqual([
      { code: 'CS1010', title: 'Programming Methodology' },
    ]);
  });

  test('rejects malformed requests before reading the catalogue', async () => {
    const request = new NextRequest(
      'https://uniplans.example/api/modules/summaries',
      {
        method: 'POST',
        body: JSON.stringify({ codes: 'CS1010' }),
        headers: { 'content-type': 'application/json' },
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(mockedGetModuleSummaries).not.toHaveBeenCalled();
  });
});
