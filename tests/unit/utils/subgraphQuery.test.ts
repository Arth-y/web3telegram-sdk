import { describe, it, expect, jest } from '@jest/globals';
import { GraphQLClient } from 'graphql-request';
import {
  getValidContact,
  checkProtectedDataValidity,
} from '../../../src/utils/subgraphQuery.js';
import type { Contact } from '../../../src/web3telegram/types.js';

describe('getValidContact', () => {
  // Define the variables in the outermost scope
  let contacts: Contact[];
  let graphQLClient: GraphQLClient;

  beforeAll(() => {
    // Initialize the variables in the beforeAll hook
    contacts = [
      {
        address: 'address1',
        owner: 'owner1',
        accessGrantTimestamp: '2023-06-08T09:32:29.761Z',
      },
      {
        address: 'address2',
        owner: 'owner2',
        accessGrantTimestamp: '2023-06-09T14:21:17.231Z',
      },
      {
        address: 'address3',
        owner: 'owner3',
        accessGrantTimestamp: '2023-06-10T14:21:17.231Z',
      },
    ];

    // Create a new instance of GraphQLClient
    graphQLClient = new GraphQLClient('');
  });

  it('should fetch valid contacts', async () => {
    // Mock the request method of the GraphQLClient instance
    jest.spyOn(graphQLClient, 'request').mockResolvedValue({
      protectedDatas: [{ id: 'address1' }, { id: 'address3' }],
    });

    const validContacts = await getValidContact(graphQLClient, contacts);

    expect(validContacts).toEqual([
      {
        address: 'address1',
        owner: 'owner1',
        accessGrantTimestamp: '2023-06-08T09:32:29.761Z',
      },
      {
        address: 'address3',
        owner: 'owner3',
        accessGrantTimestamp: '2023-06-10T14:21:17.231Z',
      },
    ]);

    expect(graphQLClient.request).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        requiredSchema: ['email:string'],
        id: ['address1', 'address2', 'address3'],
        start: expect.any(Number),
        range: 1000,
      })
    );
  });

  it('should handle error when fetching protected data', async () => {
    // Change the implementation of the mock request to simulate an error
    jest
      .spyOn(graphQLClient, 'request')
      .mockRejectedValue(new Error('Request failed'));

    await expect(getValidContact(graphQLClient, contacts)).rejects.toThrow(
      'Failed to fetch subgraph'
    );
  });
});

describe('checkProtectedDataValidity', () => {
  it('should return true if protected data is valid', async () => {
    const graphQLClient = new GraphQLClient('');
    jest.spyOn(graphQLClient, 'request').mockResolvedValue({
      protectedDatas: [{ id: 'address1' }],
    });

    const isValid = await checkProtectedDataValidity(graphQLClient, 'address1');

    expect(isValid).toBe(true);
  });
  it('should return false if protected data is invalid', async () => {
    const graphQLClient = new GraphQLClient('');
    jest.spyOn(graphQLClient, 'request').mockResolvedValue({
      protectedDatas: [],
    });

    const isValid = await checkProtectedDataValidity(graphQLClient, 'address2');

    expect(isValid).toBe(false);
  });
  it('should handle error when fetching protected data', async () => {
    const graphQLClient = new GraphQLClient('');
    jest
      .spyOn(graphQLClient, 'request')
      .mockRejectedValue(new Error('Request failed'));

    await expect(
      checkProtectedDataValidity(graphQLClient, 'address1')
    ).rejects.toThrow('Failed to fetch subgraph');
  });
});
