import * as flatbuffers from '@hub/flatbuffers';

export {
  FarcasterNetwork,
  HashScheme,
  MessageType,
  ReactionType,
  SignatureScheme,
  UserDataType,
} from '@hub/flatbuffers';

export type Message<TMessageType extends flatbuffers.MessageType = flatbuffers.MessageType> = {
  flatbuffer: flatbuffers.Message;
  data: MessageData<TMessageType>;
  hash: string; // Hex string
  hashScheme: flatbuffers.HashScheme;
  signature: string; // Hex string
  signatureScheme: flatbuffers.SignatureScheme;
  signer: string; // Hex string
  tsHash: string; // Hex string
};

export type CastAddMessage = Message<flatbuffers.MessageType.CastAdd>;
export type CastRemoveMessage = Message<flatbuffers.MessageType.CastRemove>;
export type ReactionAddMessage = Message<flatbuffers.MessageType.ReactionAdd>;
export type ReactionRemoveMessage = Message<flatbuffers.MessageType.ReactionRemove>;
export type AmpAddMessage = Message<flatbuffers.MessageType.AmpAdd>;
export type AmpRemoveMessage = Message<flatbuffers.MessageType.AmpRemove>;
export type VerificationAddEthAddressMessage = Message<flatbuffers.MessageType.VerificationAddEthAddress>;
export type VerificationRemoveMessage = Message<flatbuffers.MessageType.VerificationRemove>;
export type SignerAddMessage = Message<flatbuffers.MessageType.SignerAdd>;
export type SignerRemoveMessage = Message<flatbuffers.MessageType.SignerRemove>;
export type UserDataAddMessage = Message<flatbuffers.MessageType.UserDataAdd>;

export type MessageData<TMessageType extends flatbuffers.MessageType = flatbuffers.MessageType> = {
  body: MessageTypeBody<TMessageType>;
  type: TMessageType;
  timestamp: number;
  fid: number;
  network: flatbuffers.FarcasterNetwork;
};

export type CastId = {
  fid: number;
  tsHash: string; // Hex string
};

export type TargetId = CastId;

export type MessageBody =
  | CastAddBody
  | CastRemoveBody
  | ReactionBody
  | AmpBody
  | VerificationAddEthAddressBody
  | VerificationRemoveBody
  | SignerBody
  | UserDataBody;

export type CastAddBody = {
  embeds?: string[] | undefined;
  mentions?: number[] | undefined;
  parent?: TargetId | undefined;
  text: string;
};

export type CastRemoveBody = {
  targetTsHash: string;
};

export type ReactionBody = {
  target: TargetId;
  type: flatbuffers.ReactionType;
};

export type AmpBody = {
  user: number;
};

export type VerificationAddEthAddressBody = {
  address: string; // Hex string
  ethSignature: string; // Hex string
  blockHash: string; // Hex string
};

export type VerificationRemoveBody = {
  address: string; // Hex string
};

export type SignerBody = {
  signer: string; // Hex string
};

export type UserDataBody = {
  type: flatbuffers.UserDataType;
  value: string;
};

type MessageTypeBody<TMessageBody extends flatbuffers.MessageType> = TMessageBody extends
  | flatbuffers.MessageType.AmpAdd
  | flatbuffers.MessageType.AmpRemove
  ? AmpBody
  : TMessageBody extends flatbuffers.MessageType.CastAdd
  ? CastAddBody
  : TMessageBody extends flatbuffers.MessageType.CastRemove
  ? CastRemoveBody
  : TMessageBody extends flatbuffers.MessageType.ReactionAdd | flatbuffers.MessageType.ReactionRemove
  ? ReactionBody
  : TMessageBody extends flatbuffers.MessageType.VerificationAddEthAddress
  ? VerificationAddEthAddressBody
  : TMessageBody extends flatbuffers.MessageType.VerificationRemove
  ? VerificationRemoveBody
  : TMessageBody extends flatbuffers.MessageType.SignerAdd | flatbuffers.MessageType.SignerRemove
  ? SignerBody
  : TMessageBody extends flatbuffers.MessageType.UserDataAdd
  ? UserDataBody
  : never;
