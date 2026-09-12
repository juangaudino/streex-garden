// macOS artifact check: swift qa/inspect-film.swift <video.mp4> <output-directory>
import Foundation
import AVFoundation
import AppKit

let args = CommandLine.arguments
guard args.count == 3 else { fatalError("Expected video path and output directory") }
let url = URL(fileURLWithPath: args[1])
let output = URL(fileURLWithPath: args[2], isDirectory: true)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
let asset = AVURLAsset(url: url)
let video = asset.tracks(withMediaType: .video)
let audio = asset.tracks(withMediaType: .audio)
var result: [String: Any] = ["file": url.lastPathComponent, "durationSeconds": CMTimeGetSeconds(asset.duration), "videoTracks": video.count, "audioTracks": audio.count]
if let track = video.first { result["width"] = track.naturalSize.width; result["height"] = track.naturalSize.height }
if let track = audio.first {
  let reader = try AVAssetReader(asset: asset)
  let pcm = AVAssetReaderTrackOutput(track: track, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM, AVLinearPCMIsFloatKey: true, AVLinearPCMBitDepthKey: 32, AVLinearPCMIsNonInterleaved: false])
  reader.add(pcm)
  reader.startReading()
  var energy: Double = 0
  var samples = 0
  while let sample = pcm.copyNextSampleBuffer() {
    if let block = CMSampleBufferGetDataBuffer(sample) {
      let length = CMBlockBufferGetDataLength(block)
      var values = [Float](repeating: 0, count: length / MemoryLayout<Float>.size)
      values.withUnsafeMutableBytes { bytes in _ = CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: length, destination: bytes.baseAddress!) }
      for value in values { energy += Double(value * value) }
      samples += values.count
    }
  }
  result["audioRms"] = samples > 0 ? sqrt(energy / Double(samples)) : 0
  result["audioSamples"] = samples
}
let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero
for seconds in [0.1, 3.5, 6.5] {
  let image = try generator.copyCGImage(at: CMTime(seconds: seconds, preferredTimescale: 600), actualTime: nil)
  let png = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])!
  try png.write(to: output.appendingPathComponent("frame-\(seconds).png"))
}
let json = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
try json.write(to: output.appendingPathComponent("inspection.json"))
print(String(data: json, encoding: .utf8)!)
