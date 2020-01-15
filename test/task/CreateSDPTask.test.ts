// Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as chai from 'chai';

import AudioVideoControllerState from '../../src/audiovideocontroller/AudioVideoControllerState';
import NoOpAudioVideoController from '../../src/audiovideocontroller/NoOpAudioVideoController';
import CreateSDPTask from '../../src/task/CreateSDPTask';
import Task from '../../src/task/Task';
import DOMMockBuilder from '../dommock/DOMMockBuilder';

describe('CreateSDPTask', () => {
  const expect: Chai.ExpectStatic = chai.expect;
  let context: AudioVideoControllerState;
  let domMockBuilder: DOMMockBuilder | null = null;
  let task: Task;

  beforeEach(() => {
    domMockBuilder = new DOMMockBuilder();
    context = new AudioVideoControllerState();
    context.audioVideoController = new NoOpAudioVideoController();
    context.videoTileController = context.audioVideoController.videoTileController;
    context.logger = context.audioVideoController.logger;
    const peer: RTCPeerConnection = new RTCPeerConnection();
    context.peer = peer;
    task = new CreateSDPTask(context);
  });

  afterEach(() => {
    if (domMockBuilder) {
      domMockBuilder.cleanup();
      domMockBuilder = null;
    }
  });

  describe('construction', () => {
    it('can be constructed', () => {
      expect(task).to.not.equal(null);
    });
  });

  describe('run', () => {
    it('can be run and received parameters are correct', done => {
      class TestPeerConnectionMock extends RTCPeerConnection {
        createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
          expect(options.offerToReceiveAudio).to.be.equal(true);
          expect(options.offerToReceiveVideo).to.be.equal(false);
          return new Promise<RTCSessionDescriptionInit>((resolve, _reject) => {
            resolve();
          });
        }
      }
      const peer: RTCPeerConnection = new TestPeerConnectionMock();
      context.peer = peer;
      task.run().then(() => done());
    });

    it('can be run and the created offer SDP is correct', done => {
      task.run().then(() => {
        expect(context.sdpOfferInit.sdp).to.be.equal('sdp-offer-audio');
        done();
      });
    });

    it('can throw error during failure to create offer', done => {
      class TestPeerConnectionMock extends RTCPeerConnection {
        createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
          expect(options.offerToReceiveAudio).to.be.equal(true);
          expect(options.offerToReceiveVideo).to.be.equal(true);
          return new Promise<RTCSessionDescriptionInit>((_resolve, reject) => {
            reject();
          });
        }
      }
      const peer: RTCPeerConnection = new TestPeerConnectionMock();
      context.peer = peer;
      task.run().catch(() => done());
    });
  });
});
