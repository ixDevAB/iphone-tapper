import Foundation
import Vision

struct Line: Codable {
  let text: String
  let x: Double
  let y: Double
  let width: Double
  let height: Double
}

var accurateWorks = true

func recognize(_ image: CGImage, _ level: VNRequestTextRecognitionLevel) throws -> [VNRecognizedTextObservation] {
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = level
  request.usesLanguageCorrection = false
  try VNImageRequestHandler(cgImage: image).perform([request])
  return request.results ?? []
}

func read(_ image: CGImage) -> [VNRecognizedTextObservation] {
  if accurateWorks, let results = try? recognize(image, .accurate) {
    return results
  }
  if accurateWorks {
    accurateWorks = false
    FileHandle.standardError.write("accurate text recognition failed, using fast recognition\n".data(using: .utf8)!)
  }
  return (try? recognize(image, .fast)) ?? []
}

while let path = readLine() {
  let image = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil)
    .flatMap { CGImageSourceCreateImageAtIndex($0, 0, nil) }
  let lines = (image.map(read) ?? []).compactMap { result -> Line? in
    guard let text = result.topCandidates(1).first?.string else { return nil }
    let box = result.boundingBox
    return Line(text: text, x: box.minX, y: 1 - box.maxY, width: box.width, height: box.height)
  }
  let json = (try? JSONEncoder().encode(lines)).flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
  print(json)
  fflush(stdout)
}
