import * as grpc from '@farcaster/grpc';
import * as protobufs from '@farcaster/protobufs';
import { getHubRpcClient, HubAsyncResult, HubResult, HubRpcClient } from '@farcaster/utils';
import { err, Result } from 'neverthrow';
import * as types from './types';
import * as utils from './utils';

export type EventFilters = {
  eventTypes?: grpc.EventType[];
};

const deserializeCall = async <TDeserialized, TProtobuf>(
  call: HubAsyncResult<TProtobuf>,
  deserialize: (protobuf: TProtobuf) => HubResult<TDeserialized>
): HubAsyncResult<TDeserialized> => {
  const response = await call;
  return response.andThen((protobuf) => deserialize(protobuf));
};

const wrapGrpcMessageCall = async <T extends types.Message>(
  call: HubAsyncResult<protobufs.Message>
): HubAsyncResult<T> => {
  const response = await call;
  return response.andThen((protobuf) => utils.deserializeMessage(protobuf) as HubResult<T>);
};

const wrapGrpcMessagesCall = async <T extends types.Message>(
  call: HubAsyncResult<grpc.MessagesResponse>
): HubAsyncResult<T[]> => {
  const response = await call;
  return response.andThen((messagesResponse) => {
    return Result.combine(
      messagesResponse.messages.map((protobuf) => {
        return utils.deserializeMessage(protobuf) as HubResult<T>;
      })
    );
  });
};

export class Client {
  public _grpcClient: HubRpcClient;

  constructor(address: string) {
    this._grpcClient = getHubRpcClient(address);
  }

  // /* -------------------------------------------------------------------------- */
  // /*                                Submit Methods                              */
  // /* -------------------------------------------------------------------------- */

  async submitMessage(message: types.Message): HubAsyncResult<types.Message> {
    return wrapGrpcMessageCall(this._grpcClient.submitMessage(message._protobuf));
  }

  // /* -------------------------------------------------------------------------- */
  // /*                                 Cast Methods                               */
  // /* -------------------------------------------------------------------------- */

  async getCast(fid: number, hash: string): HubAsyncResult<types.CastAddMessage> {
    const castId = utils.serializeCastId({ fid, hash });
    if (castId.isErr()) {
      return err(castId.error);
    }

    return wrapGrpcMessageCall(this._grpcClient.getCast(castId.value));
  }

  async getCastsByFid(fid: number): HubAsyncResult<types.CastAddMessage[]> {
    const fidRequest = grpc.FidRequest.create({ fid });
    return wrapGrpcMessagesCall(this._grpcClient.getCastsByFid(fidRequest));
  }

  async getCastsByParent(parent: types.CastId): HubAsyncResult<types.CastAddMessage[]> {
    const serializedCastId = utils.serializeCastId(parent);
    if (serializedCastId.isErr()) {
      return err(serializedCastId.error);
    }

    return wrapGrpcMessagesCall(this._grpcClient.getCastsByParent(serializedCastId.value));
  }

  async getCastsByMention(mentionFid: number): HubAsyncResult<types.CastAddMessage[]> {
    const fidRequest = grpc.FidRequest.create({ fid: mentionFid });
    return wrapGrpcMessagesCall(this._grpcClient.getCastsByMention(fidRequest));
  }

  // /* -------------------------------------------------------------------------- */
  // /*                                Amp Methods                              */
  // /* -------------------------------------------------------------------------- */

  async getAmp(fid: number, targetFid: number): HubAsyncResult<types.AmpAddMessage> {
    const ampRequest = grpc.AmpRequest.create({ fid, targetFid });
    return wrapGrpcMessageCall(this._grpcClient.getAmp(ampRequest));
  }

  async getAmpsByFid(fid: number): HubAsyncResult<types.AmpAddMessage[]> {
    const fidRequest = grpc.FidRequest.create({ fid });
    return wrapGrpcMessagesCall(this._grpcClient.getAmpsByFid(fidRequest));
  }

  async getAmpsByUser(targetFid: number): HubAsyncResult<types.AmpAddMessage[]> {
    const fidRequest = grpc.FidRequest.create({ fid: targetFid });
    return wrapGrpcMessagesCall(this._grpcClient.getAmpsByUser(fidRequest));
  }

  // /* -------------------------------------------------------------------------- */
  // /*                               Reaction Methods                             */
  // /* -------------------------------------------------------------------------- */

  async getReaction(
    fid: number,
    type: types.ReactionType,
    cast: types.CastId
  ): HubAsyncResult<types.ReactionAddMessage> {
    const serializedCastId = utils.serializeCastId(cast);
    if (serializedCastId.isErr()) {
      return err(serializedCastId.error);
    }

    const reactionRequest = grpc.ReactionRequest.create({
      fid,
      reactionType: type,
      castId: serializedCastId.value,
    });
    return wrapGrpcMessageCall(this._grpcClient.getReaction(reactionRequest));
  }

  async getReactionsByFid(fid: number, type?: types.ReactionType): HubAsyncResult<types.ReactionAddMessage[]> {
    const request = grpc.ReactionsByFidRequest.create({
      fid,
      reactionType: type ?? types.ReactionType.REACTION_TYPE_NONE,
    });
    return wrapGrpcMessagesCall(this._grpcClient.getReactionsByFid(request));
  }

  async getReactionsByCast(cast: types.CastId, type?: types.ReactionType): HubAsyncResult<types.ReactionAddMessage[]> {
    const serializedCastId = utils.serializeCastId(cast);
    if (serializedCastId.isErr()) {
      return err(serializedCastId.error);
    }
    const request = grpc.ReactionsByCastRequest.create({
      castId: serializedCastId.value,
      reactionType: type ?? types.ReactionType.REACTION_TYPE_NONE,
    });
    return wrapGrpcMessagesCall(this._grpcClient.getReactionsByCast(request));
  }

  // /* -------------------------------------------------------------------------- */
  // /*                             Verification Methods                           */
  // /* -------------------------------------------------------------------------- */

  async getVerification(fid: number, address: string): HubAsyncResult<types.VerificationAddEthAddressMessage> {
    const serializedAddress = utils.serializeEthAddress(address);
    if (serializedAddress.isErr()) {
      return err(serializedAddress.error);
    }
    const request = grpc.VerificationRequest.create({ fid, address: serializedAddress.value });
    return wrapGrpcMessageCall(this._grpcClient.getVerification(request));
  }

  async getVerificationsByFid(fid: number): HubAsyncResult<types.VerificationAddEthAddressMessage[]> {
    const request = grpc.FidRequest.create({ fid });
    return wrapGrpcMessagesCall(this._grpcClient.getVerificationsByFid(request));
  }

  // /* -------------------------------------------------------------------------- */
  // /*                                 Signer Methods                             */
  // /* -------------------------------------------------------------------------- */

  async getSigner(fid: number, signer: string): HubAsyncResult<types.SignerAddMessage> {
    const serializedSigner = utils.serializeEd25519PublicKey(signer);
    if (serializedSigner.isErr()) {
      return err(serializedSigner.error);
    }
    const request = grpc.SignerRequest.create({ fid, signer: serializedSigner.value });
    return wrapGrpcMessageCall(this._grpcClient.getSigner(request));
  }

  async getSignersByFid(fid: number): HubAsyncResult<types.SignerAddMessage[]> {
    const request = grpc.FidRequest.create({ fid });
    return wrapGrpcMessagesCall(this._grpcClient.getSignersByFid(request));
  }

  async getIdRegistryEvent(fid: number): HubAsyncResult<types.IdRegistryEvent> {
    const request = grpc.FidRequest.create({ fid });
    return deserializeCall(this._grpcClient.getIdRegistryEvent(request), utils.deserializeIdRegistryEvent);
  }

  // /* -------------------------------------------------------------------------- */
  // /*                                User Data Methods                           */
  // /* -------------------------------------------------------------------------- */

  async getUserData(fid: number, type: types.UserDataType): HubAsyncResult<types.UserDataAddMessage> {
    const request = grpc.UserDataRequest.create({ fid, userDataType: type });
    return wrapGrpcMessageCall(this._grpcClient.getUserData(request));
  }

  async getUserDataByFid(fid: number): HubAsyncResult<types.UserDataAddMessage[]> {
    const request = grpc.FidRequest.create({ fid });
    return wrapGrpcMessagesCall(this._grpcClient.getUserDataByFid(request));
  }

  async getNameRegistryEvent(fname: string): HubAsyncResult<types.NameRegistryEvent> {
    const serializedFname = utils.serializeFname(fname);

    if (serializedFname.isErr()) {
      return err(serializedFname.error);
    }
    const request = grpc.NameRegistryEventRequest.create({ name: serializedFname.value });
    return deserializeCall(this._grpcClient.getNameRegistryEvent(request), utils.deserializeNameRegistryEvent);
  }

  // /* -------------------------------------------------------------------------- */
  // /*                                   Bulk Methods                             */
  // /* -------------------------------------------------------------------------- */

  async getAllCastMessagesByFid(fid: number): HubAsyncResult<(types.CastAddMessage | types.CastRemoveMessage)[]> {
    const request = grpc.FidRequest.create({ fid });
    return wrapGrpcMessagesCall(this._grpcClient.getAllCastMessagesByFid(request));
  }

  async getAllAmpMessagesByFid(fid: number): HubAsyncResult<(types.AmpAddMessage | types.AmpRemoveMessage)[]> {
    const request = grpc.FidRequest.create({ fid });
    return wrapGrpcMessagesCall(this._grpcClient.getAllAmpMessagesByFid(request));
  }

  async getAllReactionMessagesByFid(
    fid: number
  ): HubAsyncResult<(types.ReactionAddMessage | types.ReactionRemoveMessage)[]> {
    const request = grpc.FidRequest.create({ fid });
    return wrapGrpcMessagesCall(this._grpcClient.getAllReactionMessagesByFid(request));
  }

  async getAllVerificationMessagesByFid(
    fid: number
  ): HubAsyncResult<(types.VerificationAddEthAddressMessage | types.VerificationRemoveMessage)[]> {
    const request = grpc.FidRequest.create({ fid });
    return wrapGrpcMessagesCall(this._grpcClient.getAllVerificationMessagesByFid(request));
  }

  async getAllSignerMessagesByFid(fid: number): HubAsyncResult<(types.SignerAddMessage | types.SignerRemoveMessage)[]> {
    const request = grpc.FidRequest.create({ fid });
    return wrapGrpcMessagesCall(this._grpcClient.getAllSignerMessagesByFid(request));
  }

  async getAllUserDataMessagesByFid(fid: number): HubAsyncResult<types.UserDataAddMessage[]> {
    const request = grpc.FidRequest.create({ fid });
    return wrapGrpcMessagesCall(this._grpcClient.getAllUserDataMessagesByFid(request));
  }

  /* -------------------------------------------------------------------------- */
  /*                                  Event Methods                             */
  /* -------------------------------------------------------------------------- */

  /**
   * Data from this stream can be parsed using `deserializeEventResponse`.
   */
  async subscribe(filters: EventFilters = {}) {
    const request = grpc.SubscribeRequest.create({ ...filters });
    return this._grpcClient.subscribe(request);
  }
}
