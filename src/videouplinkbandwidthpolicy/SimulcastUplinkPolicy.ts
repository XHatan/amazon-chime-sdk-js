// Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import DefaultVideoAndEncodeParameter from '../videocaptureandencodeparameter/DefaultVideoCaptureAndEncodeParameter';
import VideoStreamIndex from '../videostreamindex/VideoStreamIndex';
import VideoUplinkBandwidthPolicy from './VideoUplinkBandwidthPolicy';
import SimulcastTransceiverController from '../transceivercontroller/SimulcastTransceiverController'

/** SimulcastUplinkPolicy implements capture and encode
 *  parameters that are nearly equivalent to those chosen by the
 *  traditional native clients, except for a modification to
 *  maxBandwidthKbps described below. */
export default class SimulcastUplinkPolicy implements VideoUplinkBandwidthPolicy {
  private numParticipants: number = 0;
  private optimalParameters: DefaultVideoAndEncodeParameter;
  private parametersInEffect: DefaultVideoAndEncodeParameter;
  private idealMaxBandwidthKbps = 1400;
  private hasBandwidthPriority: boolean = false;

  constructor(private selfAttendeeId: string) {
    this.optimalParameters = new DefaultVideoAndEncodeParameter(0, 0, 0, 0, true);
    this.parametersInEffect = new DefaultVideoAndEncodeParameter(0, 0, 0, 0, true);
  }

  chooseEncodingParameters(): Map<string, RTCRtpEncodingParameters> {
    const qualityMap = new Map<string, RTCRtpEncodingParameters>();
    qualityMap.set(
      SimulcastTransceiverController.LOW_LEVEL_NAME,
      {
        rid: SimulcastTransceiverController.LOW_LEVEL_NAME,
        scaleResolutionDownBy: 4,
        maxBitrate: 400
      }
    );

    qualityMap.set(
      SimulcastTransceiverController.MID_LEVEL_NAME,
      {
        rid: SimulcastTransceiverController.MID_LEVEL_NAME,
        scaleResolutionDownBy: 2,
        maxBitrate: 800
      }
    );
    qualityMap.set(
      SimulcastTransceiverController.HIGH_LEVEL_NAME,
      {
        rid: SimulcastTransceiverController.HIGH_LEVEL_NAME,
        scaleResolutionDownBy: 1,
        maxBitrate: 1400
      }
    );
    return qualityMap;
  }

  updateIndex(videoIndex: VideoStreamIndex): void {
    // the +1 for self is assuming that we intend to send video, since
    // the context here is VideoUplinkBandwidthPolicy
    this.numParticipants =
      videoIndex.numberOfVideoPublishingParticipantsExcludingSelf(this.selfAttendeeId) + 1;
    this.optimalParameters = new DefaultVideoAndEncodeParameter(
      this.captureWidth(),
      this.captureHeight(),
      this.captureFrameRate(),
      this.maxBandwidthKbps(),
      false
    );
  }

  wantsResubscribe(): boolean {
    return !this.parametersInEffect.equal(this.optimalParameters);
  }

  chooseCaptureAndEncodeParameters(): DefaultVideoAndEncodeParameter {
    this.parametersInEffect = this.optimalParameters.clone();
    return this.parametersInEffect.clone();
  }

  private captureWidth(): number {
    const width = 1280;
    return width;
  }

  private captureHeight(): number {
    let height = 720;
    return height;
  }

  private captureFrameRate(): number {
    return 15;
  }

  maxBandwidthKbps(): number {
    if (this.hasBandwidthPriority) {
      return Math.trunc(this.idealMaxBandwidthKbps);
    }
    let rate = 0;
    if (this.numParticipants <= 2) {
      rate = this.idealMaxBandwidthKbps;
    } else if (this.numParticipants <= 4) {
      rate = (this.idealMaxBandwidthKbps * 2) / 3;
    } else {
      rate = ((544 / 11 + 14880 / (11 * this.numParticipants)) / 600) * this.idealMaxBandwidthKbps;
    }
    return Math.trunc(rate);
  }

  setIdealMaxBandwidthKbps(idealMaxBandwidthKbps: number): void {
    this.idealMaxBandwidthKbps = idealMaxBandwidthKbps;
  }

  setHasBandwidthPriority(hasBandwidthPriority: boolean): void {
    this.hasBandwidthPriority = hasBandwidthPriority;
  }
}
