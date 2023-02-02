import * as grpc from '@grpc/grpc-js';
import { HubServiceClient } from './generated/rpc';

export { Metadata, Server, ServerCredentials, status } from '@grpc/grpc-js';
export type { CallOptions, Client, ClientReadableStream, ClientUnaryCall, ServiceError } from '@grpc/grpc-js';
export * from './generated/rpc';

export const getServer = (): grpc.Server => {
  const server = new grpc.Server();

  return server;
};

export const getClient = (address: string): HubServiceClient => {
  return new HubServiceClient(address, grpc.credentials.createInsecure());
};
