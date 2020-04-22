import {
  SdkStreamDescriptor,
  SdkStreamMediaType
} from '../signalingprotocol/SignalingProtocol.js';

  // TODO: Not in use yet
export default class VideoStreamDescription {
  public attendeeId: string = '';
  public groupId: number = 0;
  public streamId: number = 0;
  public ssrc: number = 0;
  public trackLabel: string = '';
  public maxBitrateKbps: number = 0;
  // average bitrate is updated every 2 seconds via bitrates messages
  // and are measured on tincan itself
  public avgBitrateKbps: number = 0;
  public maxFrameRate: number = 0;

  clone(): VideoStreamDescription {
    const newInfo = new VideoStreamDescription();
    newInfo.attendeeId = this.attendeeId;
    newInfo.groupId = this.groupId;
    newInfo.streamId = this.streamId;
    newInfo.ssrc = this.ssrc;
    newInfo.trackLabel = this.trackLabel;
    newInfo.maxBitrateKbps = this.maxBitrateKbps;
    newInfo.avgBitrateKbps = this.avgBitrateKbps;
    return newInfo;
  }

  toStreamDescriptor(): SdkStreamDescriptor {
    const descriptor = SdkStreamDescriptor.create();
    descriptor.mediaType = SdkStreamMediaType.VIDEO;

    descriptor.trackLabel = this.trackLabel;
    descriptor.attendeeId = this.attendeeId;
    descriptor.streamId = this.streamId;
    descriptor.groupId = this.groupId;
    descriptor.framerate = this.maxBitrateKbps;
    descriptor.maxBitrateKbps = this.maxBitrateKbps;
    descriptor.avgBitrateBps = this.avgBitrateKbps;
    return descriptor;
  }

}