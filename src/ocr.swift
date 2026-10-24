import Foundation
import Vision

struct Line: Codable {
  let text: String
  let x: Double
  let y: Double
  let width: Double
  let height: Double
}

while let path = readLine() {
  let image = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil)
    .flatMap { CGImageSourceCreateImageAtIndex($0, 0, nil) }
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = false
  if let image {
    try? VNImageRequestHandler(cgImage: image).perform([request])
  }
  let lines = (request.results ?? []).compactMap { result -> Line? in
    guard let text = result.topCandidates(1).first?.string else { return nil }
    let box = result.boundingBox
    return Line(text: text, x: box.minX, y: 1 - box.maxY, width: box.width, height: box.height)
  }
  let json = (try? JSONEncoder().encode(lines)).flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
  print(json)
  fflush(stdout)
}
