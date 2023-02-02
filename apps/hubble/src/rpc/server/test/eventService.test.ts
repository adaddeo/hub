import * as grpc from '@farcaster/grpc';
import * as protobufs from '@farcaster/protobufs';
import { Factories, getHubRpcClient, HubRpcClient } from '@farcaster/utils';
import Server from '~/rpc/server';
import { jestRocksDB } from '~/storage/db/jestUtils';
import Engine from '~/storage/engine';
import { MockHub } from '~/test/mocks';
import { sleep } from '~/utils/crypto';

const db = jestRocksDB('rpc.eventService.test');
const engine = new Engine(db, protobufs.FarcasterNetwork.FARCASTER_NETWORK_TESTNET);
const hub = new MockHub(db, engine);

let server: Server;
let client: HubRpcClient;

beforeAll(async () => {
  server = new Server(hub, engine);
  const port = await server.start();
  client = getHubRpcClient(`127.0.0.1:${port}`);
});

afterAll(async () => {
  await server.stop();
});

const fid = Factories.Fid.build();
const fname = Factories.Fname.build();
const ethSigner = Factories.Eip712Signer.build();
const signer = Factories.Ed25519Signer.build();
let custodyEvent: protobufs.IdRegistryEvent;
let nameRegistryEvent: protobufs.NameRegistryEvent;
let signerAdd: protobufs.SignerAddMessage;
let castAdd: protobufs.CastAddMessage;

beforeAll(async () => {
  custodyEvent = Factories.IdRegistryEvent.build({ to: ethSigner.signerKey, fid });
  nameRegistryEvent = Factories.NameRegistryEvent.build({ to: ethSigner.signerKey, fname });
  signerAdd = await Factories.SignerAddMessage.create(
    { data: { fid, signerBody: { signer: signer.signerKey } } },
    { transient: { signer: ethSigner } }
  );
  castAdd = await Factories.CastAddMessage.create({ data: { fid } }, { transient: { signer } });
});

describe('subscribe', () => {
  const setupSubscription = (eventTypes?: grpc.EventType[]) => {
    let stream: grpc.ClientReadableStream<grpc.EventResponse>;
    const events: [grpc.EventType, any][] = [];

    beforeEach(async () => {
      const request = grpc.SubscribeRequest.create({ eventTypes: eventTypes ?? [] });

      stream = (await client.subscribe(request))._unsafeUnwrap();
      stream.on('data', (response: grpc.EventResponse) => {
        if (
          response.type === grpc.EventType.EVENT_TYPE_MERGE_MESSAGE ||
          response.type === grpc.EventType.EVENT_TYPE_PRUNE_MESSAGE ||
          response.type === grpc.EventType.EVENT_TYPE_REVOKE_MESSAGE
        ) {
          events.push([response.type, protobufs.Message.toJSON(response.message!)]);
        } else if (response.type === grpc.EventType.EVENT_TYPE_MERGE_ID_REGISTRY_EVENT) {
          events.push([response.type, protobufs.IdRegistryEvent.toJSON(response.idRegistryEvent!)]);
        } else if (response.type === grpc.EventType.EVENT_TYPE_MERGE_NAME_REGISTRY_EVENT) {
          events.push([response.type, protobufs.NameRegistryEvent.toJSON(response.nameRegistryEvent!)]);
        }
      });
    });

    afterEach(async () => {
      await stream?.cancel();
    });

    return { events };
  };

  describe('without type filters', () => {
    const { events } = setupSubscription();

    test('emits event', async () => {
      await engine.mergeIdRegistryEvent(custodyEvent);
      await engine.mergeMessage(signerAdd);
      await engine.mergeMessage(castAdd);
      await sleep(1_000); // Wait for server to send events over stream
      expect(events).toEqual([
        [grpc.EventType.EVENT_TYPE_MERGE_ID_REGISTRY_EVENT, protobufs.IdRegistryEvent.toJSON(custodyEvent)],
        [grpc.EventType.EVENT_TYPE_MERGE_MESSAGE, protobufs.Message.toJSON(signerAdd)],
        [grpc.EventType.EVENT_TYPE_MERGE_MESSAGE, protobufs.Message.toJSON(castAdd)],
      ]);
    });
  });

  describe('with one type filter', () => {
    const { events } = setupSubscription([grpc.EventType.EVENT_TYPE_MERGE_MESSAGE]);

    test('emits event', async () => {
      await engine.mergeIdRegistryEvent(custodyEvent);
      await engine.mergeNameRegistryEvent(nameRegistryEvent);
      await engine.mergeMessage(signerAdd);
      await engine.mergeMessage(castAdd);
      await sleep(1_000); // Wait for server to send events over stream
      expect(events).toEqual([
        [grpc.EventType.EVENT_TYPE_MERGE_MESSAGE, protobufs.Message.toJSON(signerAdd)],
        [grpc.EventType.EVENT_TYPE_MERGE_MESSAGE, protobufs.Message.toJSON(castAdd)],
      ]);
    });
  });

  describe('with multiple type filters', () => {
    const { events } = setupSubscription([
      grpc.EventType.EVENT_TYPE_MERGE_MESSAGE,
      grpc.EventType.EVENT_TYPE_MERGE_NAME_REGISTRY_EVENT,
      grpc.EventType.EVENT_TYPE_MERGE_ID_REGISTRY_EVENT,
    ]);

    test('emits event', async () => {
      await engine.mergeIdRegistryEvent(custodyEvent);
      await engine.mergeNameRegistryEvent(nameRegistryEvent);
      await engine.mergeMessage(signerAdd);
      await engine.mergeMessage(castAdd);
      await sleep(1_000); // Wait for server to send events over stream
      expect(events).toEqual([
        [grpc.EventType.EVENT_TYPE_MERGE_ID_REGISTRY_EVENT, protobufs.IdRegistryEvent.toJSON(custodyEvent)],
        [grpc.EventType.EVENT_TYPE_MERGE_NAME_REGISTRY_EVENT, protobufs.NameRegistryEvent.toJSON(nameRegistryEvent)],
        [grpc.EventType.EVENT_TYPE_MERGE_MESSAGE, protobufs.Message.toJSON(signerAdd)],
        [grpc.EventType.EVENT_TYPE_MERGE_MESSAGE, protobufs.Message.toJSON(castAdd)],
      ]);
    });
  });
});
