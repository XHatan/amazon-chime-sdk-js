// Copyright 2019-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import BrowserBehavior from '../browserbehavior/BrowserBehavior';
import Logger from '../logger/Logger';
import VideoStreamIdSet from '../videostreamidset/VideoStreamIdSet';
import VideoStreamIndex from '../videostreamindex/VideoStreamIndex';
import TransceiverController from './TransceiverController';
// import DefaultVideoCaptureAndEncodeParameter from '../videocaptureandencodeparameter/DefaultVideoCaptureAndEncodeParameter';

export default class SimulcastTransceiverController implements TransceiverController {
  private _localCameraTransceiver: RTCRtpTransceiver | null = null;
  private _localAudioTransceiver: RTCRtpTransceiver | null = null;
  private videoSubscriptions: number[] = [];
  private defaultMediaStream: MediaStream | null = null;
  private peer: RTCPeerConnection | null = null;

  static readonly LOW_LEVEL_NAME: string = 'low';
  static readonly MID_LEVEL_NAME: string = 'mid';
  static readonly HIGH_LEVEL_NAME: string = 'hi';

  private videoQualityControlParameterMap: Map<string, RTCRtpEncodingParameters> = new Map<string, RTCRtpEncodingParameters>();

  constructor(private logger: Logger, private browserBehavior: BrowserBehavior) {
    this.videoQualityControlParameterMap.set(
      SimulcastTransceiverController.LOW_LEVEL_NAME, { rid: SimulcastTransceiverController.LOW_LEVEL_NAME, scaleResolutionDownBy: 4, maxBitrate: 300 * 1000}
    );

    this.videoQualityControlParameterMap.set(
      SimulcastTransceiverController.MID_LEVEL_NAME, { rid: SimulcastTransceiverController.MID_LEVEL_NAME, scaleResolutionDownBy: 2, maxBitrate: 600 * 1000}
    );

    this.videoQualityControlParameterMap.set(
      SimulcastTransceiverController.HIGH_LEVEL_NAME, { rid: SimulcastTransceiverController.HIGH_LEVEL_NAME, scaleResolutionDownBy: 1, maxBitrate: 1100 * 1000}
    );
  }

  static async setVideoSendingBitrateKbpsForSender(
    sender: RTCRtpSender,
    bitrateKbps: number,
    logger: Logger
  ): Promise<void> {
    if (!sender || bitrateKbps <= 0) {
      return;
    }
    const param: RTCRtpSendParameters = sender.getParameters();
    console.log('random original', param.encodings);
    if (!param.encodings) {
      param.encodings = [{}, {}, {}];
    }

    for (const encodeParam of param.encodings) {
      if (encodeParam.rid === SimulcastTransceiverController.LOW_LEVEL_NAME) {
        encodeParam.maxBitrate = 250 * 1000;
      }

      if (encodeParam.rid === SimulcastTransceiverController.MID_LEVEL_NAME) {
        encodeParam.maxBitrate = 600 * 1000;
      }

      if (encodeParam.rid === SimulcastTransceiverController.HIGH_LEVEL_NAME) {
        encodeParam.maxBitrate = 1200 * 1000;
      }
    }

    await sender.setParameters(param);
    logger.info(`set video send bandwidth to ${bitrateKbps}kbps`);
    console.log('random', sender.getParameters().encodings);
  }

  static async setVideoSendingBitrateKbpsForSender2(
    sender: RTCRtpSender,
    qualityParams: Map<string, RTCRtpEncodingParameters>,
    _logger: Logger
  ): Promise<void> {
    if (!sender || !qualityParams) {
      return;
    }
    const newEncodingParams = Array.from(qualityParams.values());
    if (newEncodingParams.length <= 0) {
      return;
    }
    console.log('random input params', newEncodingParams);

    const param: RTCRtpSendParameters = sender.getParameters();
    console.log('random original', param.encodings);
    if (!param.encodings) {
      param.encodings = newEncodingParams;
    } else {
      for (let i = 0; i < param.encodings.length; i++) {
        if (param.encodings[i].rid === SimulcastTransceiverController.LOW_LEVEL_NAME) {
          param.encodings[i].maxBitrate = qualityParams.get(SimulcastTransceiverController.LOW_LEVEL_NAME).maxBitrate;
        }
        if (param.encodings[i].rid === SimulcastTransceiverController.MID_LEVEL_NAME) {
          param.encodings[i].maxBitrate = qualityParams.get(SimulcastTransceiverController.MID_LEVEL_NAME).maxBitrate;
        }
        if (param.encodings[i].rid === SimulcastTransceiverController.HIGH_LEVEL_NAME) {
          param.encodings[i].maxBitrate = qualityParams.get(SimulcastTransceiverController.HIGH_LEVEL_NAME).maxBitrate;
        }
      }
    }

    await sender.setParameters(param);

    console.log('random get params', sender.getParameters().encodings);
  }

  static async replaceAudioTrackForSender(
    sender: RTCRtpSender,
    track: MediaStreamTrack
  ): Promise<boolean> {
    if (!sender) {
      return false;
    }

    await sender.replaceTrack(track);
    return true;
  }

  localAudioTransceiver(): RTCRtpTransceiver {
    return this._localAudioTransceiver;
  }

  localVideoTransceiver(): RTCRtpTransceiver {
    return this._localCameraTransceiver;
  }

  async setVideoSendingBitrateKbps(_bitrateKbps: number): Promise<void> {
    // this won't set bandwidth limitation for video in Chrome
    if (!this._localCameraTransceiver || this._localCameraTransceiver.direction !== 'sendrecv') {
      return;
    }
    const sender: RTCRtpSender = this._localCameraTransceiver.sender;
    await SimulcastTransceiverController.setVideoSendingBitrateKbpsForSender2(
      sender,
      this.videoQualityControlParameterMap,
      this.logger
    );
  }

  setPeer(peer: RTCPeerConnection): void {
    this.peer = peer;
  }

  reset(): void {
    this._localCameraTransceiver = null;
    this._localAudioTransceiver = null;
    this.videoSubscriptions = [];
    this.defaultMediaStream = null;
    this.peer = null;
  }

  useTransceivers(): boolean {
    if (!this.peer || !this.browserBehavior.requiresUnifiedPlan()) {
      return false;
    }

    return typeof this.peer.getTransceivers !== 'undefined';
  }

  trackIsVideoInput(track: MediaStreamTrack): boolean {
    if (!this._localCameraTransceiver) {
      return false;
    }
    return (
      track === this._localCameraTransceiver.sender.track ||
      track === this._localCameraTransceiver.receiver.track
    );
  }

  setupLocalTransceivers(): void {
    if (!this.useTransceivers()) {
      return;
    }

    if (!this.defaultMediaStream && typeof MediaStream !== 'undefined') {
      this.defaultMediaStream = new MediaStream();
    }

    if (!this._localAudioTransceiver) {
      this._localAudioTransceiver = this.peer.addTransceiver('audio', {
        direction: 'inactive',
        streams: [this.defaultMediaStream],
      });
    }

    if (!this._localCameraTransceiver) {
      this._localCameraTransceiver = this.peer.addTransceiver('video', {
        direction: 'inactive',
        streams: [this.defaultMediaStream],
        sendEncodings: Array.from(this.videoQualityControlParameterMap.values()),
      });
    }
  }

  async replaceAudioTrack(track: MediaStreamTrack): Promise<boolean> {
    if (!this._localAudioTransceiver || this._localAudioTransceiver.direction !== 'sendrecv') {
      this.logger.info(`audio transceiver direction is not set up or not activated`);
      return false;
    }
    await this._localAudioTransceiver.sender.replaceTrack(track);
    return true;
  }

  async setAudioInput(track: MediaStreamTrack | null): Promise<void> {
    await this.setTransceiverInput(this._localAudioTransceiver, track);
    return;
  }

  async setVideoInput(track: MediaStreamTrack | null): Promise<void> {
    await this.setTransceiverInput(this._localCameraTransceiver, track);
    return;
  }

  updateVideoTransceivers(
    videoStreamIndex: VideoStreamIndex,
    videosToReceive: VideoStreamIdSet
  ): number[] {
    if (!this.useTransceivers()) {
      return videosToReceive.array();
    }

    // See https://blog.mozilla.org/webrtc/rtcrtptransceiver-explored/ for details on transceivers
    const transceivers: RTCRtpTransceiver[] = this.peer.getTransceivers();

    // Subscription index 0 is reserved for transmitting camera.
    // We mark inactive slots with 0 in the subscription array.
    this.videoSubscriptions = [0];
    videosToReceive = videosToReceive.clone();
    this.videoSubscriptions =  this.unsubscribeTransceivers(transceivers, videoStreamIndex, videosToReceive, this.videoSubscriptions);
    this.subscribeTransceivers(transceivers, videosToReceive);
    this.logger.debug(() => {
      return this.debugDumpTransceivers();
    });
    return this.videoSubscriptions;
  }

  private unsubscribeTransceivers(
    transceivers: RTCRtpTransceiver[],
    videoStreamIndex: VideoStreamIndex,
    videosToReceive: VideoStreamIdSet,
    videoSubscriptions: number[]
  ): number[] {
    // disable transceivers which are no longer going to subscribe
    for (const transceiver of transceivers) {
      if (transceiver === this._localCameraTransceiver || !this.transceiverIsVideo(transceiver)) {
        continue;
      }
      // by convention with the video host, msid is equal to the media section mid, prefixed with the string "v_"
      // we use this to get the streamId for the track
      const streamId = videoStreamIndex.streamIdForTrack('v_' + transceiver.mid);
      if (streamId !== undefined && videosToReceive.contain(streamId)) {
        transceiver.direction = 'recvonly';
        videoSubscriptions.push(streamId);
        videosToReceive.remove(streamId);
      } else {
        transceiver.direction = 'inactive';
        // mark this slot inactive with a 0 in the subscription array
        videoSubscriptions.push(0);
      }
    }
    return videoSubscriptions;
  }

  private subscribeTransceivers(
    transceivers: RTCRtpTransceiver[],
    videosToReceive: VideoStreamIdSet
  ): void {
    if (videosToReceive.size() === 0) {
      return;
    }

    // Handle remaining subscriptions using existing inactive transceivers.
    const videosRemaining = videosToReceive.array();

    // Begin counting out index in the the subscription array at 1 since the camera.
    // Always occupies position 0 (whether active or not).
    let n = 1;
    for (const transceiver of transceivers) {
      if (transceiver === this._localCameraTransceiver || !this.transceiverIsVideo(transceiver)) {
        continue;
      }
      if (transceiver.direction === 'inactive') {
        transceiver.direction = 'recvonly';
        const streamId = videosRemaining.shift();
        this.videoSubscriptions[n] = streamId;
        if (videosRemaining.length === 0) {
          break;
        }
      }
      n += 1;
    }

    // add transceivers for the remaining subscriptions
    for (const index of videosRemaining) {
      // @ts-ignore
      const transceiver = this.peer.addTransceiver('video', {
        direction: 'recvonly',
        streams: [this.defaultMediaStream],
      });
      this.videoSubscriptions.push(index);
      this.logger.info(
        `adding transceiver mid: ${transceiver.mid} subscription: ${index} direction: recvonly`
      );
    }
  }

  private transceiverIsVideo(transceiver: RTCRtpTransceiver): boolean {
    return (
      (transceiver.receiver &&
        transceiver.receiver.track &&
        transceiver.receiver.track.kind === 'video') ||
      (transceiver.sender && transceiver.sender.track && transceiver.sender.track.kind === 'video')
    );
  }

  private debugDumpTransceivers(): string {
    let msg = '';
    let n = 0;

    for (const transceiver of this.peer.getTransceivers()) {
      if (!this.transceiverIsVideo(transceiver)) {
        continue;
      }
      msg += `transceiver index=${n} mid=${transceiver.mid} subscription=${this.videoSubscriptions[n]} direction=${transceiver.direction}\n`;
      n += 1;
    }
    return msg;
  }

  private async setTransceiverInput(
    transceiver: RTCRtpTransceiver | null,
    track: MediaStreamTrack
  ): Promise<void> {
    if (!transceiver) {
      return;
    }

    if (track) {
      transceiver.direction = 'sendrecv';
    } else {
      transceiver.direction = 'inactive';
    }

    await transceiver.sender.replaceTrack(track);
  }
}
