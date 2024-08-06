import pkg from '@apollo/client/core/core.cjs';
const { ApolloClient, InMemoryCache, split, HttpLink } = pkg;
import { DeepClient, parseJwt } from "@deep-foundation/deeplinks/imports/client.js";
import { generateApolloClient } from "@deep-foundation/hasura/client.js";
import { WebSocketLink } from '@apollo/client/link/ws/ws.cjs';
import { getMainDefinition } from '@apollo/client/utilities/utilities.cjs';
import { SubscriptionClient } from 'subscriptions-transport-ws';
import ws from 'ws';


const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwczovL2hhc3VyYS5pby9qd3QvY2xhaW1zIjp7IngtaGFzdXJhLWFsbG93ZWQtcm9sZXMiOlsiYWRtaW4iXSwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoiYWRtaW4iLCJ4LWhhc3VyYS11c2VyLWlkIjoiMzgwIn0sImlhdCI6MTcyMTYzNzI4M30.-Xsnzj_2C289UyWzsSXsnaFSXCukQTxaYLFTW4AQaIo';
const GQL_URN = '3006-deepfoundation-dev-f5qo0ydbv62.ws-eu115.gitpod.io/gql';
const dirPath = '/home/timax/Code/Deep-project/deep-files-sync/test';
const GQL_SSL = true;

const makeDeepClient = (token) => {
  if (!token) throw new Error("Token not provided");
  try {
    const decoded = parseJwt(token);
    const linkId = decoded['x-hasura-user-id'];

    const wsClient = new SubscriptionClient(
      `wss://${GQL_URN}`,
      {
        reconnect: true,
        connectionParams: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
      ws
    );

    const wsLink = new WebSocketLink(wsClient);

    const httpLink = new HttpLink({
      uri: `https://${GQL_URN}`,
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const link = split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
      },
      wsLink,
      httpLink
    );

    const apolloClient = new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });

    const deepClient = new DeepClient({ apolloClient, linkId, token });
    console.log('DeepClient created successfully');
    return deepClient;
  } catch (error) {
    console.error('Error creating DeepClient:', error);
    throw error;
  }
};

let deep;

try {
  deep = makeDeepClient(token);
} catch (error) {
  console.error('Could not create DeepClient:', error);
  process.exit(1);
}





(async () => {
  const sub = deep.subscribe({
    from_id: 380
  }).subscribe({
    next: (links) => {
      console.log('New links:', links);
    },
    error: (error) => {
      console.error('Subscription error:', error);
    }
  });
  const test = await deep.select({from_id: 380})
  //console.log(test, 'select')
})();