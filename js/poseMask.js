import {
  FilesetResolver,
  PoseLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.6";

export class PoseMask {
  constructor(videoEl) {
    this.video = videoEl;
    this.pose = null;
    this.results = { keypoints: null };
  }

  async init() {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.6/wasm"
    );
    this.pose = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.4,
      minPosePresenceConfidence: 0.4,
      minTrackingConfidence: 0.4,
    });
  }

  async update(ts) {
    if (!this.pose) return this.results;
    const out = await this.pose.detectForVideo(this.video, ts);
    this.results.keypoints = out?.landmarks?.[0] || null;
    return this.results;
  }
}
